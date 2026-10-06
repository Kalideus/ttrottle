// Ref for an absolutely positioned dropdown that opens below its trigger:
// if there's no room below, open it upwards instead of running off the screen.
// On phones it becomes a bottom sheet instead: full width, pinned to the bottom, clear of the home bar.
export const flipIfOffscreen = (el: HTMLElement | null) => {
  if (!el) return;
  if (window.matchMedia('(max-width: 720px)').matches) {
    Object.assign(el.style, {
      position: 'fixed', top: 'auto', bottom: '0', left: '0', right: '0', width: 'auto', minWidth: '0', maxWidth: 'none',
      margin: '0', maxHeight: '70dvh', overflowY: 'auto', zIndex: '200', borderRadius: '14px 14px 0 0',
      paddingBottom: 'calc(8px + env(safe-area-inset-bottom))', boxShadow: '0 -8px 30px rgba(0,0,0,0.25)',
    });
    return;
  }
  if (el.getBoundingClientRect().bottom > window.innerHeight) Object.assign(el.style, { top: 'auto', bottom: 'calc(100% + 4px)' });
};
