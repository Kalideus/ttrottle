import { useEffect } from 'react'

// Shared by the modal components: Escape closes the modal, matching the
// pattern already used for the task detail panel. Pass `enabled: false` to
// suppress it (e.g. ProfileModal's requireFullName mode, which shouldn't be
// dismissible at all).
export function useEscapeToClose(onClose: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, enabled])
}
