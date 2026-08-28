# Pause Carousel When Hidden

- Status: DONE
- Repository stamp: unavailable-worktree-metadata

Implemented in `src/App.jsx`.

- Carousel visibility state follows `document.visibilityState`.
- Autoplay runs only while visible and motion is allowed.
- Returning to the page starts a fresh 4.2-second dwell.
- Event listeners and intervals are cleaned up.
- Production build verified.

