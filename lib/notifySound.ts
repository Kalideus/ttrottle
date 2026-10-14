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

// 0-100, also per browser. The chime can't be louder than the computer's own volume: this sets how
// loud it is under that, so it can sit below music playing at the same time. 50 is the original level.
const VOLUME_KEY = 'track:notification-volume'

export function soundVolume(): number {
  try {
    const v = Number(localStorage.getItem(VOLUME_KEY))
    return localStorage.getItem(VOLUME_KEY) !== null && v >= 0 && v <= 100 ? v : 50
  } catch {
    return 50
  }
}

export function setSoundVolume(volume: number) {
  try {
    localStorage.setItem(VOLUME_KEY, String(volume))
  } catch {
    // not remembered, as with the on/off choice
  }
}

let ctx: AudioContext | null = null
let lastPlayed = 0

// `preview`: the Profile setting trying a level out, which skips the once-per-burst limit
export function playChime(preview = false) {
  // a burst (an import giving someone 40 tasks) chimes once, not 40 times
  if (!preview && Date.now() - lastPlayed < 3000) return
  lastPlayed = Date.now()
  const peak = (soundVolume() / 100) * 0.4
  if (peak <= 0) return
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
      gain.gain.exponentialRampToValueAtTime(peak, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
      osc.connect(gain).connect(ctx!.destination)
      osc.start(t)
      osc.stop(t + 0.4)
    })
  } catch {
    // no audio available: stay silent
  }
}
