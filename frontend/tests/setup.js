import { vi, beforeEach } from 'vitest';

// Provide a synchronous marked shim so tests don't need the CDN script.
// The real marked.parse wraps content in block-level HTML; we mirror that
// with a simple <p> wrapper so assertions can detect that it was called.
global.marked = {
  parse: vi.fn((text) => `<p>${text}</p>`),
};

// Standard DOM scaffold that mirrors the elements script.js references.
function buildDom() {
  document.body.innerHTML = `
    <div id="chatMessages"></div>
    <input id="chatInput" type="text" />
    <button id="sendButton"></button>
    <span id="totalCourses">-</span>
    <div id="courseTitles"><span class="loading">Loading...</span></div>
    <button id="newChatBtn">New Chat</button>
    <div class="suggested-items">
      <button class="suggested-item" data-question="Test question?">Test</button>
    </div>
  `;
}

beforeEach(() => {
  buildDom();
  global.fetch = vi.fn();
  vi.clearAllMocks();
  // Re-apply the marked mock after clearAllMocks resets its call history
  global.marked = { parse: vi.fn((text) => `<p>${text}</p>`) };
});
