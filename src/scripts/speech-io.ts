/**
 * Speech I/O Module
 * TTS via Web Speech API SpeechSynthesis (cross-browser)
 * STT via Web Speech API SpeechRecognition (Chrome/Edge)
 */

export class SpeechIO {
  private ttsEnabled = false;
  private speaking = false;
  private recognition: any = null;
  private recognizing = false;

  // ---- TTS ----

  get isTTSSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
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

  async speak(text: string): Promise<void> {
    if (!this.ttsEnabled || !this.isTTSSupported) return;
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

      utterance.onstart = () => {
        this.speaking = true;
      };
      utterance.onend = () => {
        this.speaking = false;
        resolve();
      };
      utterance.onerror = () => {
        this.speaking = false;
        resolve();
      };

      speechSynthesis.speak(utterance);
    });
  }

  stopSpeaking(): void {
    if (this.isTTSSupported) speechSynthesis.cancel();
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
  }
}
