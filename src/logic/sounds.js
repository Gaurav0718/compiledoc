// Sound effects were removed — Web Audio node creation on every tap was a
// measurable source of input lag on mobile (iPhone Chrome especially), even
// after batching/dedup. Keeping the same exported shape so call sites
// throughout the app don't need to change.
const noop = () => {};

export const sounds = {
  tap:     noop,
  success: noop,
  error:   noop,
  delete:  noop,
  nav:     noop,
  pop:     noop,
};

export function playSplashMusic() {}

export function initSounds() {}
