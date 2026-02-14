/**
 * Generative Ambient Music Engine
 * Uses Tone.js to create evolving ambient soundscapes with pentatonic harmony.
 * Autoplay-safe: requires user gesture to start.
 */

export class AmbientMusic {
  private synths: any[] = [];
  private filter: any = null;
  private reverb: any = null;
  private isPlaying = false;
  private initialized = false;
  private intervalId: number | null = null;
  private Tone: any = null;

  private scale = ['C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4', 'G4', 'A4'];

  async init(): Promise<void> {
    if (this.initialized) return;

    this.Tone = await import('tone');
    await this.Tone.start();

    // Create reverb and wait for impulse response to generate
    this.reverb = new this.Tone.Reverb({ decay: 6, wet: 0.6 }).toDestination();
    await this.reverb.generate();

    this.filter = new this.Tone.Filter({
      frequency: 900,
      type: 'lowpass',
    }).connect(this.reverb);

    // Pad synth — soft evolving chords
    const pad = new this.Tone.PolySynth(this.Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 2, decay: 3, sustain: 0.5, release: 4 },
      volume: -16,
    }).connect(this.filter);
    this.synths.push(pad);

    // Shimmer synth — higher random notes
    const shimmer = new this.Tone.PolySynth(this.Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.3, decay: 1.5, sustain: 0, release: 2 },
      volume: -22,
    }).connect(this.filter);
    this.synths.push(shimmer);

    this.initialized = true;
  }

  async toggle(): Promise<boolean> {
    try {
      if (!this.initialized) await this.init();

      if (this.isPlaying) {
        this.stop();
        return false;
      } else {
        this.start();
        return true;
      }
    } catch (err) {
      console.error('[AmbientMusic] Error:', err);
      return false;
    }
  }

  get playing(): boolean {
    return this.isPlaying;
  }

  private start(): void {
    this.isPlaying = true;
    // Play a chord immediately so the user hears something right away
    this.playChord();

    this.intervalId = window.setInterval(() => {
      if (Math.random() > 0.3) this.playChord();
      if (Math.random() > 0.5) this.playShimmer();
    }, 4000);
  }

  private stop(): void {
    this.isPlaying = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.synths.forEach((s) => s.releaseAll());
  }

  private playChord(): void {
    const pad = this.synths[0];
    if (!pad) return;
    const root = Math.floor(Math.random() * 5);
    const chord = [this.scale[root], this.scale[root + 2], this.scale[root + 4]];
    // Use explicit seconds for duration (not Transport-relative notation)
    pad.triggerAttackRelease(chord, 3);
  }

  private playShimmer(): void {
    const shimmer = this.synths[1];
    if (!shimmer) return;
    const note = this.scale[5 + Math.floor(Math.random() * 5)];
    shimmer.triggerAttackRelease(note, 1);
  }

  dispose(): void {
    this.stop();
    this.synths.forEach((s) => s.dispose());
    this.synths = [];
    this.filter?.dispose();
    this.reverb?.dispose();
    this.filter = null;
    this.reverb = null;
    this.initialized = false;
  }
}
