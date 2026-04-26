import { describe, it, expect, beforeEach } from 'vitest';
import {
  escapeHtml,
  addMessage,
  createLoadingMessage,
  _setDomRefs,
  _resetForTest,
} from '../script.js';

beforeEach(() => {
  _resetForTest();
  _setDomRefs();
});

// ---------------------------------------------------------------------------
// escapeHtml
// ---------------------------------------------------------------------------
describe('escapeHtml', () => {
  it('escapes < and > characters', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes & characters', () => {
    expect(escapeHtml('A & B')).toBe('A &amp; B');
  });

  it('does not encode double-quotes (safe in text nodes, not attributes)', () => {
    // div.textContent / div.innerHTML only encodes <, >, and & — quotes in
    // text nodes need no encoding and the browser leaves them as-is.
    expect(escapeHtml('"hello"')).toBe('"hello"');
  });

  it('leaves plain text unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  it('returns an empty string for empty input', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('prevents XSS: img onerror injection', () => {
    const xss = '<img src=x onerror=alert(1)>';
    const result = escapeHtml(xss);
    expect(result).not.toContain('<img');
    expect(result).toContain('&lt;img');
  });

  it('prevents XSS: script tag injection', () => {
    const result = escapeHtml('<script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });
});

// ---------------------------------------------------------------------------
// createLoadingMessage
// ---------------------------------------------------------------------------
describe('createLoadingMessage', () => {
  it('returns an element with classes "message" and "assistant"', () => {
    const el = createLoadingMessage();
    expect(el.classList.contains('message')).toBe(true);
    expect(el.classList.contains('assistant')).toBe(true);
  });

  it('contains a .loading container with exactly three child spans', () => {
    const el = createLoadingMessage();
    const loading = el.querySelector('.loading');
    expect(loading).not.toBeNull();
    expect(loading.querySelectorAll('span').length).toBe(3);
  });

  it('does not include any text content (pure animation placeholder)', () => {
    const el = createLoadingMessage();
    expect(el.querySelector('.message-content').textContent.trim()).toBe('');
  });
});

// ---------------------------------------------------------------------------
// addMessage
// ---------------------------------------------------------------------------
describe('addMessage', () => {
  it('appends a user message to #chatMessages', () => {
    addMessage('Hello', 'user');
    expect(document.querySelector('.message.user')).not.toBeNull();
  });

  it('escapes HTML in user messages to prevent XSS', () => {
    addMessage('<b>hi</b>', 'user');
    const msg = document.querySelector('.message.user');
    expect(msg.innerHTML).toContain('&lt;b&gt;');
    expect(msg.innerHTML).not.toContain('<b>');
  });

  it('runs assistant content through marked.parse', () => {
    addMessage('**bold**', 'assistant');
    expect(global.marked.parse).toHaveBeenCalledWith('**bold**');
  });

  it('wraps assistant content in rendered markup from marked', () => {
    addMessage('**bold**', 'assistant');
    const msg = document.querySelector('.message.assistant');
    expect(msg.querySelector('.message-content').innerHTML).toContain('<p>**bold**</p>');
  });

  it('does not call marked.parse for user messages', () => {
    addMessage('plain text', 'user');
    expect(global.marked.parse).not.toHaveBeenCalled();
  });

  it('appends a .sources-collapsible when sources are provided', () => {
    addMessage('answer', 'assistant', [{ label: 'Course 101', link: 'https://example.com' }]);
    expect(document.querySelector('.sources-collapsible')).not.toBeNull();
  });

  it('renders a source with a link as an <a> element', () => {
    addMessage('answer', 'assistant', [{ label: 'Course 101', link: 'https://example.com' }]);
    const anchor = document.querySelector('.sources-content a');
    expect(anchor).not.toBeNull();
    expect(anchor.getAttribute('href')).toBe('https://example.com');
    expect(anchor.textContent).toContain('Course 101');
  });

  it('renders a source without a link as a <span>', () => {
    addMessage('answer', 'assistant', [{ label: 'Unlisted Course', link: null }]);
    const span = document.querySelector('.sources-content span');
    expect(span).not.toBeNull();
    expect(span.textContent).toBe('Unlisted Course');
  });

  it('deduplicates sources with the same label', () => {
    const sources = [
      { label: 'Course 101', link: 'https://example.com' },
      { label: 'Course 101', link: 'https://example.com' },
      { label: 'Course 202', link: 'https://other.com' },
    ];
    addMessage('answer', 'assistant', sources);
    const links = document.querySelectorAll('.sources-content a');
    expect(links.length).toBe(2);
  });

  it('does not add a sources section for an empty sources array', () => {
    addMessage('answer', 'assistant', []);
    expect(document.querySelector('.sources-collapsible')).toBeNull();
  });

  it('does not add a sources section when sources is null', () => {
    addMessage('answer', 'assistant', null);
    expect(document.querySelector('.sources-collapsible')).toBeNull();
  });

  it('adds "welcome-message" class when isWelcome is true', () => {
    addMessage('Welcome!', 'assistant', null, true);
    expect(document.querySelector('.message.welcome-message')).not.toBeNull();
  });

  it('does not add "welcome-message" class by default', () => {
    addMessage('Hello', 'assistant');
    expect(document.querySelector('.message.welcome-message')).toBeNull();
  });

  it('returns a numeric message ID', () => {
    const id = addMessage('Hello', 'user');
    expect(typeof id).toBe('number');
  });

  it('assigns the returned ID as the element id attribute', () => {
    const id = addMessage('Hello', 'user');
    expect(document.getElementById(`message-${id}`)).not.toBeNull();
  });

  it('scrolls chatMessages to the bottom after appending', () => {
    const container = document.getElementById('chatMessages');
    Object.defineProperty(container, 'scrollHeight', { configurable: true, value: 500 });
    addMessage('Hello', 'user');
    expect(container.scrollTop).toBe(500);
  });
});
