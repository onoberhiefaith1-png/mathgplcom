/** Focus an already-visible editor without jumping the nearest scroll parent. */
export const focusWithoutScroll = (el: HTMLElement | null | undefined): void => {
  el?.focus({ preventScroll: true });
};
