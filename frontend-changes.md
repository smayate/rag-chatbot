# Frontend Code Quality Changes

## script.js

### Deprecated API fix
- Replaced `keypress` event listener with `keydown`. `keypress` is deprecated and unreliable for non-printable keys.

### Multi-line input support
- Added Shift+Enter support: pressing Enter sends the message; Shift+Enter inserts a newline.
- Added `autoResizeInput()`: the textarea expands vertically as the user types (up to 200 px), then scrolls.

### Request cancellation with AbortController
- Added `currentAbortController` global to track the in-flight fetch request.
- `sendMessage()` aborts any previous request before starting a new one.
- `createNewSession()` also aborts the in-flight request so stale responses cannot arrive after a session reset.
- `AbortError` is caught silently (not shown to the user as an error).

### Character limit with live counter
- Added `MAX_INPUT_CHARS = 2000` constant.
- `updateCharCounter()` shows a `count/2000` badge in amber once the user exceeds 80% of the limit, and in red at the limit.
- `sendMessage()` rejects queries that exceed the limit.
- Counter and textarea height are reset after each send.

### Better error messages
- Server errors now parse the JSON response body for a `detail` field and fall back to the HTTP status code.
- Network failures (`Failed to fetch`) produce a human-readable "Network error" message instead of the raw exception text.

### Accessibility
- `escapeHtml()` is now also applied to course titles rendered in the sidebar (was missing before, potential XSS vector if course names contained HTML characters).

### Minor cleanups
- Removed stale `console.log` calls from `loadCourseStats()`.
- Removed unnecessary blank lines and normalised spacing.

---

## index.html

### Textarea instead of input
- Replaced `<input type="text">` with `<textarea rows="1">` to support multi-line input and auto-resize.
- Added `spellcheck="true"` and kept `autocomplete="off"`.
- Added `maxlength="2000"` as a browser-level guard alongside the JS limit.
- Updated placeholder text to mention Shift+Enter.

### Accessibility (ARIA)
- Added `role="log"` and `aria-live="polite"` to `#chatMessages` so screen readers announce new messages.
- Added `aria-label="Chat conversation"` to `#chatMessages`.
- Added `aria-label="Chat message input"` to the textarea.
- Added `aria-label="Send message"` to the send button.
- Added `aria-label="Start a new chat session"` to the New Chat button.
- Added `aria-live="polite"` to the character counter span.

### Structure
- Wrapped the textarea and character counter in a new `.input-wrapper` div to support vertical stacking within the flex row.
- Added `<span id="charCounter" class="char-counter">` below the textarea.
- Bumped cache-busting version on `script.js` to `?v=13`.

---

## style.css

### Input wrapper
- Added `.input-wrapper` flex column that holds the textarea and the char counter, taking `flex: 1` from the removed `#chatInput` rule.

### Textarea styles
- `#chatInput` converted from input to textarea styles: `resize: none`, `min-height: 46px`, `max-height: 200px`, `overflow-y: auto`, `font-family: inherit`, `line-height: 1.5`.
- Removed the `all 0.2s ease` shorthand transition (too broad); replaced with specific `border-color` and `box-shadow` transitions to avoid animating height during auto-resize.

### Character counter
- Added `.char-counter`, `.char-counter.warning`, and `.char-counter.error` rules.
- Counter is invisible (`color: transparent`) when empty so it still occupies space and prevents layout shift.

### Send button alignment
- `align-items: flex-end` added to `.chat-input-container` (both desktop and mobile breakpoint) so the send button stays anchored to the bottom of the input area when the textarea grows.
