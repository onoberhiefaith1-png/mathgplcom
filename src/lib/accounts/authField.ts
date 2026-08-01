/**
 * One field style for every authentication screen.
 *
 * The auth pages sit on a deep navy background, so any field that inherits the
 * page text colour renders white-on-white and what the visitor types becomes
 * invisible. Every input, select and textarea on those pages uses this class so
 * the ink stays dark on the white field.
 */
export const AUTH_FIELD =
  "min-h-[44px] bg-white text-slate-900 placeholder:text-slate-400 border-slate-300 focus-visible:ring-amber-400 [color-scheme:light]";
