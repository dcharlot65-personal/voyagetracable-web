/**
 * Speech I/O Module
 * TTS via Kokoro server (mlx-audio, M4 Metal) with Web Speech API fallback
 * STT via Web Speech API SpeechRecognition (Chrome/Edge)
 */

const TTS_API = '/api/tts/v1/audio/speech';
const TTS_HEALTH = '/api/tts/v1/models';
const TTS_MODEL = 'mlx-community/Kokoro-82M-bf16';
const TTS_VOICE = 'af_heart';

export class SpeechIO {
  private ttsEnabled = false;
  private speaking = false;
  private recognition: any = null;
  private recognizing = false;
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private kokoroAvailable: boolean | null = null;

  // ---- TTS ----

  get isTTSSupported(): boolean {
    return typeof window !== 'undefined';
  }

  get isTTSEnabled(): boolean {
    return this.ttsEnabled;
  }

  get isSpeaking(): boolean {
    return this.speaking;
  }

  setTTSEnabled(enabled: boolean): void {
    this.ttsEnabled = enabled;
    if (!enabled) this.stopSpeaking();
  }

  toggleTTS(): boolean {
    this.setTTSEnabled(!this.ttsEnabled);
    return this.ttsEnabled;
  }

  private async checkKokoro(): Promise<boolean> {
    if (this.kokoroAvailable !== null) return this.kokoroAvailable;
    try {
      const res = await fetch(TTS_HEALTH, { signal: AbortSignal.timeout(3000) });
      this.kokoroAvailable = res.ok;
    } catch {
      this.kokoroAvailable = false;
    }
    return this.kokoroAvailable;
  }

  private async speakKokoro(text: string): Promise<void> {
    const res = await fetch(TTS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: TTS_MODEL,
        input: text,
        voice: TTS_VOICE,
        speed: 1.0,
        response_format: 'wav',
      }),
    });

    if (!res.ok) throw new Error(`Kokoro error: ${res.status}`);

    const audioData = await res.arrayBuffer();
    if (audioData.byteLength === 0) throw new Error('Empty audio response');

    if (!this.audioContext) this.audioContext = new AudioContext();
    if (this.audioContext.state === 'suspended') await this.audioContext.resume();

    const audioBuffer = await this.audioContext.decodeAudioData(audioData);
    this.currentSource = this.audioContext.createBufferSource();
    this.currentSource.buffer = audioBuffer;
    this.currentSource.connect(this.audioContext.destination);

    return new Promise<void>((resolve) => {
      this.currentSource!.onended = () => {
        this.speaking = false;
        this.currentSource = null;
        resolve();
      };
      this.speaking = true;
      this.currentSource!.start(0);
    });
  }

  private speakWebSpeech(text: string): Promise<void> {
    if (!('speechSynthesis' in window)) return Promise.resolve();
    speechSynthesis.cancel();

    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 0.8;

      const voices = speechSynthesis.getVoices();
      const preferred = voices.find(
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Google'))
      );
      if (preferred) utterance.voice = preferred;

      utterance.onstart = () => { this.speaking = true; };
      utterance.onend = () => { this.speaking = false; resolve(); };
      utterance.onerror = () => { this.speaking = false; resolve(); };

      speechSynthesis.speak(utterance);
    });
  }

  async speak(text: string): Promise<void> {
    if (!this.ttsEnabled || !this.isTTSSupported) return;
    this.stopSpeaking();

    // Try Kokoro server first, fall back to Web Speech API
    if (await this.checkKokoro()) {
      try {
        return await this.speakKokoro(text);
      } catch (err) {
        console.warn('[TTS] Kokoro failed, falling back to Web Speech:', err);
        this.kokoroAvailable = null; // re-check next time
      }
    }

    return this.speakWebSpeech(text);
  }

  stopSpeaking(): void {
    // Stop Kokoro audio
    if (this.currentSource) {
      try { this.currentSource.stop(); } catch { /* ignore */ }
      this.currentSource = null;
    }
    // Stop Web Speech
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    this.speaking = false;
  }

  // ---- STT ----

  get isSTTSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
    );
  }

  get isListening(): boolean {
    return this.recognizing;
  }

  startListening(onResult: (text: string) => void, onEnd?: () => void): void {
    if (!this.isSTTSupported || this.recognizing) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      onResult(text);
    };

    this.recognition.onend = () => {
      this.recognizing = false;
      onEnd?.();
    };

    this.recognition.onerror = () => {
      this.recognizing = false;
      onEnd?.();
    };

    this.recognizing = true;
    this.recognition.start();
  }

  stopListening(): void {
    if (this.recognition && this.recognizing) {
      this.recognition.stop();
      this.recognizing = false;
    }
  }

  dispose(): void {
    this.stopSpeaking();
    this.stopListening();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
