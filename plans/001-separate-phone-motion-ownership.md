# Separate Phone Motion Ownership

- Status: DONE
- Repository stamp: unavailable-worktree-metadata

Implemented in `src/App.jsx` and `src/styles.css`.

- GSAP now animates `.destination-phone-shell`.
- Keyed screen changes animate `.destination-phone-output` only.
- Screen transition: `280ms cubic-bezier(.16,1,.3,1)`, opacity plus `translateY(10px)`.
- Reduced motion disables the screen transition.
- Production build verified.

