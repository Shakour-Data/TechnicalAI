/**
 * Ollama Local Client — Replaces z-ai-web-dev-sdk with local Ollama models
 * Installed models at E:\Ollama\ with Ollama running at http://localhost:11434
 *
 * Project becomes 100% local, zero external API costs.
 */

const OLLAMA_BASE_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'gpt-oss:20b';
const FALLBACK_MODELS = ['deepseek-v3.1:671b', 'glm-4.6:6b', 'stable-code:3b-code-q4_0'];

let ollamaInstance: OllamaClient | null = null;

/**
 * Ollama client singleton — handles chat completions and page reader via local Ollama API.
 */
export class OllamaClient {
  private baseURL: string;
  private defaultModel: string;
  private modelChain: string[];

  constructor(options: {
    baseURL?: string;
    model?: string;
    timeoutMs?: number;
  } = {}) {
    this.baseURL = options.baseURL || OLLAMA_BASE_URL;
    this.defaultModel = options.model || DEFAULT_MODEL;
    this.modelChain = [
      this.defaultModel,
      ...FALLBACK_MODELS,
    ];
  }

  /**
   * Get the singleton instance.
   */
  static getInstance(options?: { baseURL?: string; model?: string; timeoutMs?: number }): OllamaClient {
    if (!ollamaInstance) {
      ollamaInstance = new OllamaClient(options);
    }
    return ollamaInstance;
  }

  /**
   * Auto-detect best model for the task.
   * - Chat completion: gpt-oss:20b or deepseek-v3.1
   * - Code analysis: stable-code:3b-code-q4_0
   * - Persian analysis: deepseek-v3.1 or glm-4.6
   */
  getModelForTask(task: 'chat' | 'code' | 'persian' | 'general' = 'general'): string {
    switch (task) {
      case 'code':
        return this.modelChain.find(m => m.includes('stable-code')) || this.defaultModel;
      case 'persian':
        return this.modelChain.find(m => m.includes('deepseek-v3.1') || m.includes('glm-4.6')) || this.defaultModel;
      case 'chat':
      default:
        return this.modelChain[0];
    }
  }

  /**
   * Chat completion via Ollama API.
   * Supports: multiple message roles, temperature, max_tokens, stream: false
   */
  async chatCompletion(
    messages: Array<{ role: string; content: string }>,
    options?: {
      temperature?: number;
      max_tokens?: number;
      model?: string;
      stream?: boolean;
    }
  ): Promise<string> {
    const model = options?.model || this.defaultModel;
    const temperature = options?.temperature ?? 0.7;
    const maxTokens = options?.max_tokens ?? 4096;
    const stream = options?.stream !== false;

    const payload: any = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream,
    };

    const response = await fetch(`${this.baseURL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errText}`);
    }

    const data = await response.json();

    if (!data?.message?.content) {
      throw new Error('Ollama returned no response content');
    }

    return data.message.content;
  }

  /**
   * Page reader via Ollama — fetches raw HTML from a URL.
   * This uses Ollama's embeddings or a direct fetch approach.
   * Since Ollama doesn't have a native page_reader, we fetch HTML directly.
   */
  async pageReader(url: string): Promise<{ data: { html: string } }> {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }

    const html = await response.text();
    return { data: { html } };
  }

  /**
   * Check if Ollama server is running and models are available.
   */
  async healthCheck(): Promise<{ ok: boolean; models: string[] }> {
    try {
      const response = await fetch(`${this.baseURL}/api/tags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return { ok: false, models: [] };
      }

      const data = await response.json();
      const models: string[] = data?.models?.map((m: any) => m.name) || [];

      return { ok: models.length > 0, models };
    } catch (err) {
      return { ok: false, models: [] };
    }
  }

  /**
   * Get the default model name.
   */
  getDefaultModel(): string {
    return this.defaultModel;
  }

  /**
   * Check if a specific model is available.
   */
  async isModelAvailable(modelName: string): Promise<boolean> {
    const { models } = await this.healthCheck();
    return models.includes(modelName);
  }

  /**
   * Select the best available model from the chain.
   */
  async selectBestModel(): Promise<string> {
    for (const model of this.modelChain) {
      const available = await this.isModelAvailable(model);
      if (available) {
        return model;
      }
    }
    return this.defaultModel;
  }
}

/**
 * Get the Ollama client singleton instance.
 */
export function getOllama(options?: { baseURL?: string; model?: string; timeoutMs?: number }): OllamaClient {
  return OllamaClient.getInstance(options);
}

/**
 * Chat completion using the Ollama client (replaces zai.chat.completions.create).
 */
export async function ollamaChatCompletion(
  messages: Array<{ role: string; content: string }>,
  options?: {
    temperature?: number;
    max_tokens?: number;
    model?: string;
  }
): Promise<string> {
  const ollama = getOllama(options?.model ? { model: options.model } : undefined);
  return ollama.chatCompletion(messages, options);
}

/**
 * Page reader using Ollama local fetch (replaces zai.functions.invoke('page_reader', {url})).
 */
export async function ollamaPageReader(url: string): Promise<{ data: { html: string } }> {
  const ollama = getOllama();
  return ollama.pageReader(url);
}

/**
 * Health check Ollama server.
 */
export async function ollamaHealthCheck(): Promise<{ ok: boolean; models: string[] }> {
  const ollama = getOllama();
  return ollama.healthCheck();
}