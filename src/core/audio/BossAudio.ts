// ============================================================
// BossAudio — procedurally-synthesized boss fight cues
// Pure Web Audio API: no asset files, no external dependencies.
// ============================================================

/**
 * Four cue methods trigger short synthesized sounds. The AudioContext is
 * created lazily on first cue so we don't crash during SSR and don't trip
 * browser autoplay policies before the user has interacted with the page.
 */
export class BossAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  /** Session mute. Flip from the caller if a settings UI lands later. */
  muted = false

  /** Lazily build the AudioContext + a master gain node. */
  private ensureCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (this.ctx && this.ctx.state !== 'closed') return this.ctx

    const AC: typeof AudioContext | undefined =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!AC) return null

    try {
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.55
      this.master.connect(this.ctx.destination)
    } catch {
      this.ctx = null
      this.master = null
    }
    return this.ctx
  }

  /** Contexts created before a user gesture start suspended — resume on-demand. */
  private resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
  }

  // --- Public cues ---

  /** Alarm / foghorn: two alternating sawtooth tones, 3 cycles. */
  bossStart(): void {
    const ctx = this.ensureCtx()
    if (!ctx || this.muted || !this.master) return
    this.resume()
    const now = ctx.currentTime
    const notes = [220, 330, 220, 330, 220, 330]
    const step = 0.18

    notes.forEach((freq, i) => {
      const t0 = now + i * step
      const t1 = t0 + step - 0.02

      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = freq

      // Vibrato modulates the pitch ±4 Hz at 8 Hz.
      const lfo = ctx.createOscillator()
      lfo.frequency.value = 8
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = 4
      lfo.connect(lfoGain).connect(osc.frequency)

      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(800, t0)
      filter.frequency.linearRampToValueAtTime(1800, t0 + 0.1)
      filter.frequency.linearRampToValueAtTime(400, t1)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, t0)
      gain.gain.exponentialRampToValueAtTime(0.5, t0 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t1)

      osc.connect(filter).connect(gain).connect(this.master!)
      osc.start(t0)
      osc.stop(t1 + 0.05)
      lfo.start(t0)
      lfo.stop(t1 + 0.05)
    })
  }

  /** High bell — three sine partials stacked, quick attack + long decay. */
  shieldDrop(): void {
    const ctx = this.ensureCtx()
    if (!ctx || this.muted || !this.master) return
    this.resume()
    const now = ctx.currentTime
    const partials = [1200, 1800, 2400]
    const weights = [1.0, 0.5, 0.25]

    partials.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.35 * weights[i], now + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6)
      osc.connect(gain).connect(this.master!)
      osc.start(now)
      osc.stop(now + 0.7)
    })
  }

  /** Explosion (brown-noise lowpass sweep) then an ascending major arpeggio. */
  bossDeath(): void {
    const ctx = this.ensureCtx()
    if (!ctx || this.muted || !this.master) return
    this.resume()
    const now = ctx.currentTime

    // 1 — detonation
    const noise = this.createBrownNoise(ctx, 0.5)
    const noiseFilter = ctx.createBiquadFilter()
    noiseFilter.type = 'lowpass'
    noiseFilter.frequency.setValueAtTime(2000, now)
    noiseFilter.frequency.exponentialRampToValueAtTime(100, now + 0.4)
    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(0.5, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
    noise.connect(noiseFilter).connect(noiseGain).connect(this.master)
    noise.start(now)
    noise.stop(now + 0.5)

    // 2 — reward arpeggio (C4 → E4 → G4 → C5)
    const chord = [262, 330, 392, 523]
    chord.forEach((freq, i) => {
      const t0 = now + 0.15 + i * 0.08
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = freq
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, t0)
      gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5)
      osc.connect(gain).connect(this.master!)
      osc.start(t0)
      osc.stop(t0 + 0.55)
    })
  }

  /** Sub-bass rumble: filtered brown noise + low sawtooth drone. */
  phaseChange(): void {
    const ctx = this.ensureCtx()
    if (!ctx || this.muted || !this.master) return
    this.resume()
    const now = ctx.currentTime
    const duration = 0.9

    const noise = this.createBrownNoise(ctx, duration)
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 180
    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(0.0001, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.6, now + 0.1)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration)
    noise.connect(filter).connect(noiseGain).connect(this.master)
    noise.start(now)
    noise.stop(now + duration)

    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = 42
    const oscGain = ctx.createGain()
    oscGain.gain.setValueAtTime(0.0001, now)
    oscGain.gain.exponentialRampToValueAtTime(0.4, now + 0.15)
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration)
    osc.connect(oscGain).connect(this.master)
    osc.start(now)
    osc.stop(now + duration)
  }

  /** Close and free the AudioContext. */
  dispose(): void {
    if (this.ctx) {
      this.ctx.close().catch(() => {})
      this.ctx = null
      this.master = null
    }
  }

  // --- Helpers ---

  /** Brown (red) noise feels warmer than white and sits better under a filter. */
  private createBrownNoise(ctx: AudioContext, durationSec: number): AudioBufferSourceNode {
    const size = Math.floor(ctx.sampleRate * durationSec)
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < size; i++) {
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.5
    }
    const src = ctx.createBufferSource()
    src.buffer = buffer
    return src
  }
}
