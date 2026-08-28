# Synchronize Carousel Transitions

- Status: DONE
- Repository stamp: unavailable-worktree-metadata

Implemented in `src/App.jsx` and `src/styles.css`.

- Caption content is keyed to the active slide.
- Caption entrance uses `420ms cubic-bezier(.16,1,.3,1)`.
- Image opacity and scale transitions use `600ms` and `800ms`.
- Incoming scale begins at `1.012`.
- Progress indicators animate with `scaleX`, not width.
- Inactive images do not receive pointer events.
- Production build verified.

