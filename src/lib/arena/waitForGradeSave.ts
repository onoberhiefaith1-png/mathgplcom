/** Wake a pending Arena confirmation as soon as its marking write lands. */
export function waitForGradeSave(ms: number): Promise<void> {
  return new Promise(resolve => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      window.removeEventListener('arena:grade-saved', finish);
      resolve();
    };
    const timer = window.setTimeout(finish, ms);
    window.addEventListener('arena:grade-saved', finish, { once: true });
  });
}
