/** Inline practice uses the document scroll; standalone boards own their pane. */
export function scrollBoardHost(host: HTMLElement, top: number, embedded: boolean) {
  if (embedded) {
    window.scrollTo({ top: Math.max(0, window.scrollY + host.getBoundingClientRect().top + top), behavior: "smooth" });
  } else {
    host.scrollTo({ top, behavior: "smooth" });
  }
}
