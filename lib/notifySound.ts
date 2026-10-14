// A short two-note chime for a new notification, made by the browser (no sound file). Browsers only
// let a page make sound once it has been clicked on, which a page someone works in always has.
// The on/off choice is per person, kept in this browser (Profile > Notification sound).
// ponytail: per browser, not per account; move it to a profiles column if people want it to follow them between computers

const KEY = 'track:notification-sound'

export function soundOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    // private window or blocked storage: the choice just isn't remembered
  }
}

let ctx: AudioContext | null = null
let lastPlayed = 0

export function playChime() {
  // a burst (an import giving someone 40 tasks) chimes once, not 40 times
  if (Date.now() - lastPlayed < 3000) return
  lastPlayed = Date.now()
  try {
    ctx ??= new AudioContext()
    void ctx.resume()
    const start = ctx.currentTime
    ;[880, 1320].forEach((freq, i) => {
      const t = start + i * 0.12
      const osc = ctx!.createOscillator()
      const gain = ctx!.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
      osc.connect(gain).connect(ctx!.destination)
      osc.start(t)
      osc.stop(t + 0.4)
    })
  } catch {
    // no audio available: stay silent
  }
}
