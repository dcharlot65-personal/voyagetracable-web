/**
 * WebLLM Engine Wrapper
 * Lazy-loads @mlc-ai/web-llm and manages model lifecycle, streaming generation,
 * and fallback responses when WebGPU is unavailable.
 */

const MODEL_ID = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';

export interface EngineProgress {
  status: 'checking' | 'downloading' | 'loading' | 'ready' | 'error' | 'unsupported';
  progress: number;
  message: string;
}

type ProgressCallback = (p: EngineProgress) => void;

export class AIEngine {
  private engine: any = null;
  private loading = false;
  private systemPrompt = '';
  private conversationHistory: Array<{ role: string; content: string }> = [];
  private progressCallbacks = new Set<ProgressCallback>();

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'gpu' in navigator;
  }

  setSystemPrompt(siteName: string, siteContext: string): void {
    this.systemPrompt = [
      `You are an AI assistant on the website of ${siteName}.`,
      `IMPORTANT FACTS - use ONLY these facts when answering:`,
      siteContext,
      `RULES:`,
      `- ONLY use the facts above. Do NOT make up information.`,
      `- If unsure, say "I'd recommend checking the About or Work page for details."`,
      `- Keep answers to 2-3 sentences.`,
      `- Be friendly and professional.`,
    ].join('\n');
  }

  onProgress(cb: ProgressCallback): () => void {
    this.progressCallbacks.add(cb);
    return () => this.progressCallbacks.delete(cb);
  }

  async loadModel(): Promise<boolean> {
    if (this.engine) return true;
    if (this.loading) return false;

    if (!AIEngine.isSupported()) {
      this.notify({
        status: 'unsupported',
        progress: 0,
        message: 'WebGPU is not available in this browser. Using basic mode.',
      });
      return false;
    }

    this.loading = true;
    this.notify({ status: 'checking', progress: 0, message: 'Initializing WebGPU...' });

    try {
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm');

      this.engine = await CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (report: { progress: number; text: string }) => {
          const pct = Math.round(report.progress * 100);
          this.notify({
            status: pct < 100 ? 'downloading' : 'loading',
            progress: pct,
            message: report.text,
          });
        },
      });

      this.loading = false;
      this.notify({ status: 'ready', progress: 100, message: 'AI ready' });
      return true;
    } catch (err) {
      this.loading = false;
      const message = err instanceof Error ? err.message : 'Failed to load AI model';
      this.notify({ status: 'error', progress: 0, message });
      return false;
    }
  }

  get isReady(): boolean {
    return this.engine !== null;
  }

  get isLoading(): boolean {
    return this.loading;
  }

  private buildMessages(userMessage: string): Array<{ role: string; content: string }> {
    this.conversationHistory.push({ role: 'user', content: userMessage });

    return [
      { role: 'system', content: this.systemPrompt },
      ...this.conversationHistory.slice(-8),
    ];
  }

  async generate(userMessage: string): Promise<string> {
    if (!this.engine) return this.fallbackResponse(userMessage);

    const messages = this.buildMessages(userMessage);

    try {
      const reply = await this.engine.chat.completions.create({
        messages,
        max_tokens: 150,
        temperature: 0.3,
        top_p: 0.85,
        repetition_penalty: 1.1,
      });

      const content = reply.choices[0]?.message?.content ?? '';
      this.conversationHistory.push({ role: 'assistant', content });
      return content;
    } catch {
      const fallback = this.fallbackResponse(userMessage);
      this.conversationHistory.pop(); // remove the user message we added
      return fallback;
    }
  }

  async *generateStream(userMessage: string): AsyncGenerator<string> {
    if (!this.engine) {
      yield this.fallbackResponse(userMessage);
      return;
    }

    const messages = this.buildMessages(userMessage);

    try {
      const stream = await this.engine.chat.completions.create({
        messages,
        max_tokens: 150,
        temperature: 0.3,
        top_p: 0.85,
        repetition_penalty: 1.1,
        stream: true,
      });

      let fullResponse = '';
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? '';
        if (delta) {
          fullResponse += delta;
          yield delta;
        }
      }
      this.conversationHistory.push({ role: 'assistant', content: fullResponse });
    } catch {
      this.conversationHistory.pop();
      yield this.fallbackResponse(userMessage);
    }
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }

  private fallbackResponse(input: string): string {
    const lower = input.toLowerCase();

    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
      return "Hello! I'm running in basic mode right now. For the full AI experience, try Chrome 113+ with WebGPU support. How can I help?";
    }
    if (lower.includes('who') && (lower.includes('david') || lower.includes('you'))) {
      return 'David Charlot, PhD is a bioengineering innovator and AI pioneer. He founded AuraSense, Charlot Biosciences, and Open Interface Engineering. Visit the About page to learn more!';
    }
    if (lower.includes('aurasense')) {
      return 'AuraSense is pioneering generative AI for neurology assessments, detecting patterns invisible to the human eye. Check the Work page for details.';
    }
    if (lower.includes('contact') || lower.includes('reach') || lower.includes('email')) {
      return 'You can reach David at david@davidjcharlot.com or visit the Contact page to send a message directly.';
    }
    if (lower.includes('work') || lower.includes('project') || lower.includes('venture')) {
      return "David's ventures include AuraSense (AI neurology), Charlot Biosciences (cell analysis), and OpenIE (interface engineering). Visit the Work page for the full portfolio.";
    }

    return "I'm in basic mode without full AI capabilities. For the best experience, use Chrome 113+ with WebGPU. In the meantime, feel free to explore the site or visit the Contact page to reach David directly.";
  }

  private notify(p: EngineProgress): void {
    for (const cb of this.progressCallbacks) cb(p);
  }
}
