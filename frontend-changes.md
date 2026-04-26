# Frontend Changes: Dark/Light Mode Toggle

## Files Modified

### `frontend/index.html`
- Added an inline `<script>` in `<head>` that runs synchronously to read `localStorage` (or fall back to `prefers-color-scheme`) and set `data-theme` on `<html>` before first paint, preventing any flash of wrong theme.
- Made the `<header>` functional: replaced the subtitle paragraph with a circular `#themeToggle` button containing two overlaid SVGs — a sun icon (shown in dark mode) and a moon icon (shown in light mode).
- Bumped cache-busting version on `style.css` (v11→v12) and `script.js` (v12→v13).

### `frontend/style.css`
- **CSS variables**: Extended `:root` with two new variables — `--code-bg` and `--source-link-color`/`--source-link-hover` — so code blocks and source-link chips adapt to the theme.
- **Light theme**: Added `[data-theme="light"]` block overriding all colour variables to a clean off-white palette (`--background: #f8fafc`, `--surface: #ffffff`, lighter borders and secondary text, lighter code background, and darker blue source links for readability).
- **Header**: Changed `header` from `display: none` to `display: flex` with `justify-content: space-between`, giving it a slim bar (background `var(--surface)`, border-bottom `var(--border-color)`). Title font-size reduced to `1.1rem` to suit the compact bar.
- **Toggle button styles**: `.theme-toggle` is a 38 px circle with hover scale and focus ring. A `@keyframes theme-spin` animation (rotate + scale pulse over 0.4 s) plays on click via the `.spinning` class.
- **Icon crossfade animation**: `.icon-sun` and `.icon-moon` are `position: absolute` inside the button. CSS transitions on `opacity` and `transform` create a smooth crossfade-with-rotate when the `data-theme` attribute changes.
- **Smooth theme transitions**: A targeted list of UI surfaces (body, header, sidebar, chat containers, inputs, message bubbles, etc.) gets `transition: background-color 0.25s, color 0.25s, border-color 0.25s` so the theme change feels fluid without interfering with existing `transform`/`opacity` animations (loading dots, message fade-in).
- **Replaced hardcoded colours**: `rgba(0,0,0,0.2)` in code/pre blocks → `var(--code-bg)`; `#60a5fa`/`#93c5fd` on source chips → `var(--source-link-color)`/`var(--source-link-hover)`.

### `frontend/script.js`
- **`getTheme()`**: Reads `data-theme` from `<html>`.
- **`applyTheme(theme)`**: Sets `data-theme` on `<html>` and persists the choice to `localStorage`.
- **`toggleTheme()`**: Determines the next theme, triggers the spin animation on the button, then calls `applyTheme()`. The `.spinning` class is removed automatically via a one-shot `animationend` listener.
- **`setupEventListeners()`**: Wired the `click` event on `#themeToggle` to `toggleTheme()`.

## Behaviour Summary

| Scenario | Result |
|---|---|
| First visit, system dark | Page loads in dark mode |
| First visit, system light | Page loads in light mode |
| User clicks toggle | Theme switches instantly with 0.25 s colour fade + 0.4 s button spin |
| User refreshes | Saved preference restored from `localStorage` with no flash |
| User changes OS preference | Reflected on next first visit (if no saved preference) |
