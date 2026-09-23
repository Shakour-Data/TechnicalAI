/**
 * Generic OpenAI-compatible API Client
 * 
 * Works with any OpenAI-compatible API (OpenAI, Azure OpenAI, Anthropic via proxy, 
 * local models like vLLM/Ollama with OpenAI-compatible endpoint, etc.)
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ApiClientConfig {
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  timeoutMs?: number;
}

let clientInstance: AiClient | null = null;

export class AiClient {
  private baseUrl: string;
  private apiKey: string;
  private defaultModel: string;
  private timeoutMs: number;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.defaultModel = config.defaultModel;
    this.timeoutMs = config.timeoutMs ?? 120_000;
  }

  static getInstance(config?: ApiClientConfig): AiClient | null {
    if (config && !clientInstance) {
      clientInstance = new AiClient(config);
    }
    return clientInstance;
  }

  static resetInstance(): void {
    clientInstance = null;
  }

  static getStoredInstance(): AiClient | null {
    return clientInstance;
  }

  async chatCompletion(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
  ): Promise<string> {
    const model = options.model ?? this.defaultModel;
    const temperature = options.temperature ?? 0.7;
    const maxTokens = options.max_tokens ?? 4096;
    const topP = options.top_p ?? 1.0;
    const stream = options.stream ?? false;

    const payload = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      top_p: topP,
      stream,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API error (${response.status}): ${errText}`);
      }

      const data: ChatCompletionResponse = await response.json();

      if (!data?.choices?.[0]?.message?.content) {
        throw new Error('API returned no response content');
      }

      return data.choices[0].message.content;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeoutMs}ms`);
      }
      throw err;
    }
  }

  async healthCheck(): Promise<{ ok: boolean; models: string[] }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return { ok: false, models: [] };
      }

      const data = await response.json();
      const models: string[] = data?.data?.map((m: any) => m.id) || [];

      return { ok: models.length > 0, models };
    } catch {
      return { ok: false, models: [] };
    }
  }
}

export function createAiClient(config: ApiClientConfig): AiClient {
  return new AiClient(config);
}

export function getAiClient(config?: ApiClientConfig): AiClient | null {
  if (config) {
    return AiClient.getInstance(config);
  }
  return AiClient.getStoredInstance();
}