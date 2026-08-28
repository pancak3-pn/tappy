# React to Reduced Motion Changes

- Status: DONE
- Repository stamp: unavailable-worktree-metadata

Implemented in `src/App.jsx`.

- The carousel subscribes to live reduced-motion preference changes.
- Modern `addEventListener` and older Safari `addListener` are supported.
- Autoplay stops immediately without resetting the active slide.
- Listener cleanup is implemented.
- Production build verified.

