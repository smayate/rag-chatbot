import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sendMessage,
  loadCourseStats,
  _setDomRefs,
  _resetForTest,
} from '../script.js';

beforeEach(() => {
  _resetForTest();
  _setDomRefs();
});

// ---------------------------------------------------------------------------
// sendMessage
// ---------------------------------------------------------------------------
describe('sendMessage', () => {
  it('does nothing when the input is empty', async () => {
    document.getElementById('chatInput').value = '';
    await sendMessage();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does nothing when the input is only whitespace', async () => {
    document.getElementById('chatInput').value = '   ';
    await sendMessage();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('appends the user message to the chat area', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ answer: 'Response', session_id: 'sess-1', sources: [] }),
    });
    document.getElementById('chatInput').value = 'What is RAG?';
    await sendMessage();
    const userMsg = document.querySelector('.message.user');
    expect(userMsg).not.toBeNull();
    expect(userMsg.textContent).toContain('What is RAG?');
  });

  it('appends the assistant response to the chat area', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ answer: 'RAG stands for…', session_id: 'sess-1', sources: [] }),
    });
    document.getElementById('chatInput').value = 'What is RAG?';
    await sendMessage();
    const assistantMsgs = document.querySelectorAll('.message.assistant');
    expect(assistantMsgs.length).toBeGreaterThan(0);
  });

  it('clears the input field after sending', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ answer: 'ok', session_id: 'sess-1', sources: [] }),
    });
    const input = document.getElementById('chatInput');
    input.value = 'Hello?';
    await sendMessage();
    expect(input.value).toBe('');
  });

  it('disables input and button while waiting for the response', async () => {
    let resolveFetch;
    global.fetch.mockReturnValueOnce(
      new Promise((resolve) => { resolveFetch = resolve; })
    );
    const input = document.getElementById('chatInput');
    const btn = document.getElementById('sendButton');
    input.value = 'Question?';

    const pending = sendMessage();
    expect(input.disabled).toBe(true);
    expect(btn.disabled).toBe(true);

    resolveFetch({ ok: true, json: async () => ({ answer: 'ok', session_id: 's', sources: [] }) });
    await pending;
  });

  it('re-enables input and button after a successful response', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ answer: 'ok', session_id: 'sess-1', sources: [] }),
    });
    document.getElementById('chatInput').value = 'Question?';
    await sendMessage();
    expect(document.getElementById('chatInput').disabled).toBe(false);
    expect(document.getElementById('sendButton').disabled).toBe(false);
  });

  it('re-enables input and button even after a fetch error', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));
    document.getElementById('chatInput').value = 'Question?';
    await sendMessage();
    expect(document.getElementById('chatInput').disabled).toBe(false);
    expect(document.getElementById('sendButton').disabled).toBe(false);
  });

  it('shows an error message when fetch rejects', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));
    document.getElementById('chatInput').value = 'Question?';
    await sendMessage();
    const msgs = document.querySelectorAll('.message.assistant');
    const errorMsg = Array.from(msgs).find(m => m.textContent.includes('Error: Network error'));
    expect(errorMsg).not.toBeNull();
  });

  it('shows an error message when the server returns a non-ok status', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false });
    document.getElementById('chatInput').value = 'Question?';
    await sendMessage();
    const msgs = document.querySelectorAll('.message.assistant');
    const errorMsg = Array.from(msgs).find(m => m.textContent.includes('Error'));
    expect(errorMsg).not.toBeNull();
  });

  it('POSTs to /api/query with the trimmed query in the body', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ answer: 'ok', session_id: 'sess-1', sources: [] }),
    });
    document.getElementById('chatInput').value = '  My query  ';
    await sendMessage();
    expect(global.fetch).toHaveBeenCalledWith('/api/query', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"query":"My query"'),
    }));
  });

  it('includes Content-Type: application/json header', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ answer: 'ok', session_id: 'sess-1', sources: [] }),
    });
    document.getElementById('chatInput').value = 'Hello';
    await sendMessage();
    expect(global.fetch).toHaveBeenCalledWith('/api/query', expect.objectContaining({
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
    }));
  });

  it('passes null session_id on first message', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ answer: 'ok', session_id: 'new-sess', sources: [] }),
    });
    document.getElementById('chatInput').value = 'First message';
    await sendMessage();
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.session_id).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// loadCourseStats
// ---------------------------------------------------------------------------
describe('loadCourseStats', () => {
  it('fetches from /api/courses', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ total_courses: 0, course_titles: [] }),
    });
    await loadCourseStats();
    expect(global.fetch).toHaveBeenCalledWith('/api/courses');
  });

  it('updates the totalCourses element with the count', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ total_courses: 5, course_titles: ['A', 'B', 'C', 'D', 'E'] }),
    });
    await loadCourseStats();
    expect(document.getElementById('totalCourses').textContent).toBe('5');
  });

  it('renders each course title as a .course-title-item element', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ total_courses: 2, course_titles: ['Python 101', 'React Basics'] }),
    });
    await loadCourseStats();
    const items = document.querySelectorAll('.course-title-item');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toBe('Python 101');
    expect(items[1].textContent).toBe('React Basics');
  });

  it('shows a .no-courses message when the course list is empty', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ total_courses: 0, course_titles: [] }),
    });
    await loadCourseStats();
    expect(document.querySelector('.no-courses')).not.toBeNull();
  });

  it('sets totalCourses to "0" on fetch failure', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));
    await loadCourseStats();
    expect(document.getElementById('totalCourses').textContent).toBe('0');
  });

  it('shows a .error element in courseTitles on fetch failure', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));
    await loadCourseStats();
    expect(document.querySelector('#courseTitles .error')).not.toBeNull();
  });

  it('sets totalCourses to "0" when response is not ok', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false });
    await loadCourseStats();
    expect(document.getElementById('totalCourses').textContent).toBe('0');
  });
});
