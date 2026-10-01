// Use as `ref={openPicker}` on a date input to pop its calendar open as soon as it mounts.
// Needs the user's click that opened it (transient activation); if the browser refuses, it's just a focused input.
export function openPicker(el: HTMLInputElement | null) {
  try {
    el?.showPicker();
  } catch {}
}
