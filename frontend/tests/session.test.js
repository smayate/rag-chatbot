import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createNewSession,
  _setDomRefs,
  _resetForTest,
  _setSessionId,
} from '../script.js';

beforeEach(() => {
  _resetForTest();
  _setDomRefs();
});

describe('createNewSession', () => {
  it('shows a welcome message after creation', async () => {
    await createNewSession();
    const welcome = document.querySelector('.message.welcome-message');
    expect(welcome).not.toBeNull();
    expect(welcome.textContent).toContain('Welcome');
  });

  it('clears all existing messages before showing the welcome message', async () => {
    document.getElementById('chatMessages').innerHTML = `
      <div class="message user">Old question</div>
      <div class="message assistant">Old answer</div>
    `;
    await createNewSession();
    const messages = document.querySelectorAll('#chatMessages .message');
    expect(messages.length).toBe(1);
  });

  it('does NOT call DELETE fetch when there is no existing session', async () => {
    // currentSessionId is null after _resetForTest
    await createNewSession();
    const deleteCalls = global.fetch.mock.calls.filter(
      ([url, opts]) => opts?.method === 'DELETE'
    );
    expect(deleteCalls.length).toBe(0);
  });

  it('calls DELETE /api/session/<id> for the previous session', async () => {
    _setSessionId('existing-session-abc');
    global.fetch.mockResolvedValueOnce({}); // the DELETE response
    await createNewSession();
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/session/existing-session-abc',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('resets the session ID to null after clearing', async () => {
    _setSessionId('old-session');
    global.fetch.mockResolvedValueOnce({});
    await createNewSession();
    // Next createNewSession should NOT send a DELETE for the old ID
    vi.clearAllMocks();
    global.fetch = vi.fn();
    await createNewSession();
    const deleteCalls = global.fetch.mock.calls.filter(
      ([, opts]) => opts?.method === 'DELETE'
    );
    expect(deleteCalls.length).toBe(0);
  });

  it('continues gracefully even if the DELETE request fails', async () => {
    _setSessionId('flaky-session');
    global.fetch.mockRejectedValueOnce(new Error('Server down'));
    await expect(createNewSession()).resolves.not.toThrow();
    const welcome = document.querySelector('.message.welcome-message');
    expect(welcome).not.toBeNull();
  });
});
