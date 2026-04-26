const API_URL = '/api';
const MAX_INPUT_CHARS = 2000;

let currentSessionId = null;
let currentAbortController = null;

// DOM elements (set in _setDomRefs)
let chatMessages, chatInput, sendButton, totalCourses, courseTitles, charCounter;

// Theme helpers
function getTheme() {
    return document.documentElement.getAttribute('data-theme') || 'dark';
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

function toggleTheme() {
    const btn = document.getElementById('themeToggle');
    const next = getTheme() === 'dark' ? 'light' : 'dark';

    btn.classList.add('spinning');
    btn.addEventListener('animationend', () => btn.classList.remove('spinning'), { once: true });

    applyTheme(next);
}

// Separate DOM ref setup from full init so tests can wire up the DOM without
// triggering async side-effects (createNewSession / loadCourseStats).
function _setDomRefs() {
    chatMessages = document.getElementById('chatMessages');
    chatInput = document.getElementById('chatInput');
    sendButton = document.getElementById('sendButton');
    totalCourses = document.getElementById('totalCourses');
    courseTitles = document.getElementById('courseTitles');
    charCounter = document.getElementById('charCounter');
}

// Resets all module-level state; used by tests between cases.
function _resetForTest() {
    currentSessionId = null;
    currentAbortController = null;
    chatMessages = null;
    chatInput = null;
    sendButton = null;
    totalCourses = null;
    courseTitles = null;
    charCounter = null;
}

// Directly set the session ID; used by tests that need a pre-existing session.
function _setSessionId(id) {
    currentSessionId = id;
}

function init() {
    _setDomRefs();
    setupEventListeners();
    createNewSession();
    loadCourseStats();
}

// Auto-initialize only in browser, not during Vitest runs.
if (!import.meta.env?.TEST) {
    document.addEventListener('DOMContentLoaded', init);
}

function setupEventListeners() {
    sendButton.addEventListener('click', sendMessage);

    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    chatInput.addEventListener('input', () => {
        autoResizeInput();
        updateCharCounter();
    });

    document.getElementById('newChatBtn').addEventListener('click', createNewSession);

    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);


    document.querySelectorAll('.suggested-item').forEach(button => {
        button.addEventListener('click', (e) => {
            const question = e.target.getAttribute('data-question');
            chatInput.value = question;
            autoResizeInput();
            updateCharCounter();
            sendMessage();
        });
    });
}

function autoResizeInput() {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 200) + 'px';
}

function updateCharCounter() {
    const len = chatInput.value.length;
    const warningThreshold = Math.floor(MAX_INPUT_CHARS * 0.8);

    if (len >= warningThreshold) {
        charCounter.textContent = `${len}/${MAX_INPUT_CHARS}`;
        charCounter.className = 'char-counter' + (len >= MAX_INPUT_CHARS ? ' error' : ' warning');
    } else {
        charCounter.textContent = '';
        charCounter.className = 'char-counter';
    }
}

async function sendMessage() {
    const query = chatInput.value.trim();
    if (!query || query.length > MAX_INPUT_CHARS) return;

    chatInput.value = '';
    chatInput.style.height = 'auto';
    updateCharCounter();
    chatInput.disabled = true;
    sendButton.disabled = true;

    addMessage(query, 'user');

    const loadingMessage = createLoadingMessage();
    chatMessages.appendChild(loadingMessage);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (currentAbortController) currentAbortController.abort();
    currentAbortController = new AbortController();

    try {
        const response = await fetch(`${API_URL}/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, session_id: currentSessionId }),
            signal: currentAbortController.signal,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(errorData?.detail || `Server error (${response.status})`);
        }

        const data = await response.json();

        if (!currentSessionId) {
            currentSessionId = data.session_id;
        }

        loadingMessage.remove();
        addMessage(data.answer, 'assistant', data.sources);

    } catch (error) {
        if (error.name === 'AbortError') return;
        loadingMessage.remove();
        const message = error.message.includes('Failed to fetch')
            ? 'Network error — please check your connection and try again.'
            : `Error: ${error.message}`;
        addMessage(message, 'assistant');
    } finally {
        currentAbortController = null;
        chatInput.disabled = false;
        sendButton.disabled = false;
        chatInput.focus();
    }
}

function createLoadingMessage() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    messageDiv.innerHTML = `
        <div class="message-content">
            <div class="loading">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `;
    return messageDiv;
}

function addMessage(content, type, sources = null, isWelcome = false) {
    const messageId = Date.now();
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}${isWelcome ? ' welcome-message' : ''}`;
    messageDiv.id = `message-${messageId}`;

    const displayContent = type === 'assistant' ? marked.parse(content) : escapeHtml(content);

    let html = `<div class="message-content">${displayContent}</div>`;

    if (sources && sources.length > 0) {
        const seen = new Set();
        const sourceLinks = sources
            .filter(s => { const key = s.label; if (seen.has(key)) return false; seen.add(key); return true; })
            .map(s =>
                s.link
                    ? `<a href="${s.link}" target="_blank" rel="noopener noreferrer">&#128279; ${s.label}</a>`
                    : `<span>${s.label}</span>`
            ).join('');
        html += `
            <details class="sources-collapsible">
                <summary>Sources</summary>
                <div class="sources-content">${sourceLinks}</div>
            </details>
        `;
    }

    messageDiv.innerHTML = html;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    return messageId;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function createNewSession() {
    if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
    }
    if (currentSessionId) {
        await fetch(`${API_URL}/session/${currentSessionId}`, { method: 'DELETE' }).catch(() => {});
    }
    currentSessionId = null;
    chatMessages.innerHTML = '';
    addMessage('Welcome to the Course Materials Assistant! I can help you with questions about courses, lessons and specific content. What would you like to know?', 'assistant', null, true);
}

async function loadCourseStats() {
    try {
        const response = await fetch(`${API_URL}/courses`);
        if (!response.ok) throw new Error('Failed to load course stats');

        const data = await response.json();

        if (totalCourses) {
            totalCourses.textContent = data.total_courses;
        }

        if (courseTitles) {
            if (data.course_titles && data.course_titles.length > 0) {
                courseTitles.innerHTML = data.course_titles
                    .map(title => `<div class="course-title-item">${escapeHtml(title)}</div>`)
                    .join('');
            } else {
                courseTitles.innerHTML = '<span class="no-courses">No courses available</span>';
            }
        }

    } catch (error) {
        if (totalCourses) totalCourses.textContent = '0';
        if (courseTitles) {
            courseTitles.innerHTML = '<span class="error">Failed to load courses</span>';
        }
    }
}

export {
    escapeHtml,
    addMessage,
    createLoadingMessage,
    createNewSession,
    loadCourseStats,
    sendMessage,
    setupEventListeners,
    autoResizeInput,
    updateCharCounter,
    init,
    _setDomRefs,
    _resetForTest,
    _setSessionId,
};
