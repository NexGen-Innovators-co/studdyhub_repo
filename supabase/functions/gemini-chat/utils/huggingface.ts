const HF_API_ORIGIN = Deno.env.get('HF_API_ORIGIN') || 'https://router.huggingface.co';
const HF_API_TOKEN = Deno.env.get('HF_API_TOKEN');

export interface HfChatOptions {
  model?: string;
  parameters?: Record<string, unknown>;
}

export interface HfChatResult {
  success: boolean;
  text?: string;
  model?: string;
  error?: string;
  raw?: any;
}

export async function callHfChat(
  prompt: string,
  options: HfChatOptions = {},
): Promise<HfChatResult> {
  if (!HF_API_TOKEN) {
    return {
      success: false,
      error: 'HF_API_TOKEN not configured. Set HF_API_TOKEN in Supabase Edge Function secrets.',
    };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${HF_API_TOKEN}`,
  };

  const defaultModels = [
    'openai/gpt-oss-120b:fastest',
    'deepseek-ai/DeepSeek-R1:fastest',
    'meta-llama/Meta-Llama-3-8B-Instruct:fastest',
  ];
  const modelChain = (Deno.env.get('HF_CHAT_MODEL_CHAIN') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const models = [options.model || Deno.env.get('HF_DEFAULT_MODEL') || '', ...modelChain, ...defaultModels]
    .map((value) => value.trim())
    .filter((value, index, array) => value && array.indexOf(value) === index);

  const bodyParameters = options.parameters || {};
  const temperature = typeof bodyParameters.temperature === 'number' ? bodyParameters.temperature : undefined;
  const topP = typeof bodyParameters.top_p === 'number' ? bodyParameters.top_p : undefined;
  const maxTokens = typeof bodyParameters.max_tokens === 'number'
    ? bodyParameters.max_tokens
    : typeof bodyParameters.max_new_tokens === 'number'
      ? bodyParameters.max_new_tokens
      : undefined;

  const messages = [{ role: 'user', content: prompt }];

  for (const model of models) {
    try {
      const response = await fetch(`${HF_API_ORIGIN}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          ...(temperature !== undefined ? { temperature } : {}),
          ...(topP !== undefined ? { top_p: topP } : {}),
          ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
        }),
      });

      const text = await response.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      if (!response.ok) {
        const errorMessage = data?.error?.message || data?.error || data?.message || `Hugging Face request failed with status ${response.status}`;
        if (response.status === 401 || response.status === 403) {
          return { success: false, error: errorMessage, raw: data };
        }
        continue;
      }

      const content = data?.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.trim()) {
        return { success: true, text: content, model, raw: data };
      }

      if (Array.isArray(content)) {
        const joined = content.map((part) => part?.text ?? '').join('');
        if (joined.trim()) {
          return { success: true, text: joined, model, raw: data };
        }
      }

      continue;
    } catch (err: any) {
      const errorText = `Hugging Face error: ${err?.message ?? String(err)}`;
      if (String(err?.status || '').startsWith('4')) {
        return { success: false, error: errorText };
      }
      continue;
    }
  }

  return {
    success: false,
    error: 'ALL_HF_MODELS_FAILED. All Hugging Face router models returned errors. Check token, rate limits, and model availability.',
  };
}
