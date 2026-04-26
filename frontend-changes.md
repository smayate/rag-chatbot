# Frontend Changes

## Dark/Light Mode Toggle

### `frontend/index.html`
- Added an inline `<script>` in `<head>` that runs synchronously to read `localStorage` (or fall back to `prefers-color-scheme`) and set `data-theme` on `<html>` before first paint, preventing any flash of wrong theme.
- Made the `<header>` functional: replaced the subtitle paragraph with a circular `#themeToggle` button containing two overlaid SVGs — a sun icon (shown in dark mode) and a moon icon (shown in light mode).

### `frontend/style.css`
- **CSS variables**: Extended `:root` with `--code-bg`, `--source-link-color`, `--source-link-hover`.
- **Light theme**: Added `[data-theme="light"]` block overriding all colour variables.
- **Header**: Changed from `display: none` to `display: flex` with `justify-content: space-between`.
- **Toggle button styles**: `.theme-toggle` is a 38 px circle with hover scale, focus ring, and `@keyframes theme-spin` animation.
- **Icon crossfade**: `.icon-sun` / `.icon-moon` use CSS transitions on `opacity` and `transform`.
- **Smooth transitions**: Key UI surfaces get `transition: background-color 0.25s, color 0.25s, border-color 0.25s`.

### `frontend/script.js`
- Added `getTheme()`, `applyTheme(theme)`, `toggleTheme()`.
- Wired `#themeToggle` click to `toggleTheme()` in `setupEventListeners()`.

---

## Code Quality Improvements

### `frontend/script.js`
- Replaced deprecated `keypress` with `keydown`; Shift+Enter inserts newline, Enter sends.
- Added `autoResizeInput()`: textarea grows up to 200 px then scrolls.
- Added `currentAbortController` — cancels in-flight requests on new send or session reset; `AbortError` caught silently.
- Added `MAX_INPUT_CHARS = 2000` with live `updateCharCounter()` badge (amber at 80%, red at limit).
- Improved error messages: parses JSON `detail` field; humanises network failures.
- `escapeHtml()` applied to sidebar course titles (XSS fix).
- Removed stale `console.log` calls.

### `frontend/index.html`
- Replaced `<input>` with `<textarea rows="1">` for multi-line support.
- Added ARIA: `role="log"`, `aria-live="polite"`, `aria-label` on messages, input, send button, and New Chat button.
- Added `.input-wrapper` div + `<span id="charCounter">`.

### `frontend/style.css`
- Added `.input-wrapper` flex column.
- Converted `#chatInput` to textarea styles (`resize: none`, `min-height`, `max-height`, `overflow-y`).
- Added `.char-counter`, `.char-counter.warning`, `.char-counter.error`.
- `align-items: flex-end` on `.chat-input-container` for bottom-anchored send button.
