// Size a textarea to fit its text. Use as both `ref={autoGrow}` (fits existing text on open)
// and `onInput={(e) => autoGrow(e.currentTarget)}`. A CSS max-height caps it; past that it scrolls.
// ponytail: CSS `field-sizing: content` does this natively; switch once Firefox supports it.
export function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  // scrollHeight excludes the border; add it back for border-box sizing
  el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
}
