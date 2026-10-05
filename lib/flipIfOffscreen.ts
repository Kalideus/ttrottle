// Ref for an absolutely positioned dropdown that opens below its trigger:
// if there's no room below, open it upwards instead of running off the screen.
export const flipIfOffscreen = (el: HTMLElement | null) => {
  if (el && el.getBoundingClientRect().bottom > window.innerHeight) Object.assign(el.style, { top: 'auto', bottom: 'calc(100% + 4px)' });
};
