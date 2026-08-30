// Central registry of every AI provider Nutrideel can talk to. Each entry describes
// how aiService should shape its request (apiFormat), where it sends that request
// (baseUrl), which models are offered in the picker, and whether that provider's
// vision endpoint can be used for photo-based food logging.
//
// All requests are made directly from the device to the provider — there is no
// Nutrideel backend sitting in between. Keys are entered by the user in
// Profile > AI Access and stored with expo-secure-store (see storage.ts).

export type ApiFormat = 'gemini' | 'openai' | 'anthropic';

export interface AIModelOption {
  id: string;
  label: string;
  description: string;
  supportsVision?: boolean; // overrides the provider-level default for this specific model
}

export interface ProviderDef {
  id: string;
  label: string;
  shortLabel: string;
  apiFormat: ApiFormat;
  baseUrl: string; // ignored for id === 'custom', which reads a user-supplied base URL instead
  requiresKey: boolean;
  supportsVision: boolean;
  keyPlaceholder: string;
  keyHelpUrl?: string;
  models: AIModelOption[];
  description: string;
}

export const OFFLINE_PROVIDER_ID = 'offline';

export const AI_PROVIDERS: ProviderDef[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    shortLabel: 'Gemini',
    apiFormat: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    requiresKey: true,
    supportsVision: true,
    keyPlaceholder: 'AIza...',
    keyHelpUrl: 'https://aistudio.google.com/apikey',
    description: 'Free tier available. Strong vision support for photo logging.',
    models: [
      { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash', description: 'Newest and most capable Flash model — best default' },
      { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', description: 'Flagship model, highest accuracy, slower and pricier' },
      { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', description: 'Previous-gen Flash, still fast and capable' },
      { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', description: 'Balanced speed and quality' },
      { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', description: 'Low-latency, cost-effective' },
      { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite', description: 'Fastest and cheapest, good for quick estimates' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (legacy)', description: 'Older generation, kept for compatibility' },
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    shortLabel: 'OpenAI',
    apiFormat: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    requiresKey: true,
    supportsVision: true,
    keyPlaceholder: 'sk-...',
    keyHelpUrl: 'https://platform.openai.com/api-keys',
    description: 'Industry-standard models with vision support.',
    models: [
      { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', description: 'Flagship — complex reasoning and coding' },
      { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', description: 'Balanced performance and cost' },
      { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', description: 'Fast and cheap, great default for food logging' },
      { id: 'gpt-5.4-nano', label: 'GPT-5.4 Nano', description: 'Cheapest option, text only', supportsVision: false },
    ],
  },
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    shortLabel: 'Claude',
    apiFormat: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    requiresKey: true,
    supportsVision: true,
    keyPlaceholder: 'sk-ant-...',
    keyHelpUrl: 'https://console.anthropic.com/settings/keys',
    description: 'Excellent reasoning and food-label reading from photos.',
    models: [
      { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', description: 'Fast and affordable, handles images' },
      { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', description: 'Balanced flagship model — great default' },
      { id: 'claude-opus-5', label: 'Claude Opus 5', description: 'Most capable, higher cost' },
    ],
  },
  {
    id: 'groq',
    label: 'Groq',
    shortLabel: 'Groq',
    apiFormat: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    requiresKey: true,
    supportsVision: true,
    keyPlaceholder: 'gsk_...',
    keyHelpUrl: 'https://console.groq.com/keys',
    description: 'Extremely fast inference with a generous free tier.',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', description: 'Strong general-purpose text model', supportsVision: false },
      { id: 'llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout', description: 'Newer multimodal Llama 4 model' },
      { id: 'llama-4-maverick-17b-128e-instruct', label: 'Llama 4 Maverick', description: 'Larger Llama 4 variant, multimodal' },
    ],
  },
  {
    id: 'xai',
    label: 'xAI Grok',
    shortLabel: 'Grok',
    apiFormat: 'openai',
    baseUrl: 'https://api.x.ai/v1',
    requiresKey: true,
    supportsVision: true,
    keyPlaceholder: 'xai-...',
    keyHelpUrl: 'https://console.x.ai',
    description: "xAI's Grok models, OpenAI-compatible API.",
    models: [
      { id: 'grok-4.6', label: 'Grok 4.6', description: 'Flagship — long-running agents and visual work' },
      { id: 'grok-4.3', label: 'Grok 4.3', description: 'Previous flagship, still strong and multimodal' },
      { id: 'grok-4.1-fast', label: 'Grok 4.1 Fast', description: 'Cheap, high-volume tier, large context' },
    ],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    shortLabel: 'OpenRouter',
    apiFormat: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    requiresKey: true,
    supportsVision: true,
    keyPlaceholder: 'sk-or-...',
    keyHelpUrl: 'https://openrouter.ai/keys',
    description: 'One key, dozens of routed models from every major lab.',
    models: [
      { id: 'google/gemini-3.7-flash', label: 'Gemini 3.7 Flash (via OpenRouter)', description: 'Routed Gemini, multimodal' },
      { id: 'openai/gpt-5.6-luna', label: 'GPT-5.6 Luna (via OpenRouter)', description: 'Routed OpenAI, multimodal' },
      { id: 'anthropic/claude-haiku-4.5', label: 'Claude Haiku 4.5 (via OpenRouter)', description: 'Routed Claude, multimodal' },
      { id: 'x-ai/grok-4.1-fast', label: 'Grok 4.1 Fast (via OpenRouter)', description: 'Routed Grok, large context' },
      { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B (via OpenRouter)', description: 'Text only', supportsVision: false },
    ],
  },
  {
    id: 'mistral',
    label: 'Mistral AI',
    shortLabel: 'Mistral',
    apiFormat: 'openai',
    baseUrl: 'https://api.mistral.ai/v1',
    requiresKey: true,
    supportsVision: true,
    keyPlaceholder: 'API key from console.mistral.ai',
    keyHelpUrl: 'https://console.mistral.ai/api-keys',
    description: 'European provider with a free tier and vision models.',
    models: [
      { id: 'pixtral-12b-2409', label: 'Pixtral 12B', description: 'Vision-capable Mistral model' },
      { id: 'mistral-small-latest', label: 'Mistral Small', description: 'Fast, cheap, text only', supportsVision: false },
      { id: 'mistral-large-latest', label: 'Mistral Large', description: 'Flagship reasoning model', supportsVision: false },
    ],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    shortLabel: 'DeepSeek',
    apiFormat: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    requiresKey: true,
    supportsVision: false,
    keyPlaceholder: 'sk-...',
    keyHelpUrl: 'https://platform.deepseek.com/api_keys',
    description: 'Very low cost, strong reasoning. Text only — no photo logging.',
    models: [
      { id: 'deepseek-chat', label: 'DeepSeek Chat', description: 'General purpose, low cost' },
      { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner', description: 'Slower, deeper chain-of-thought reasoning' },
    ],
  },
  {
    id: 'together',
    label: 'Together AI',
    shortLabel: 'Together',
    apiFormat: 'openai',
    baseUrl: 'https://api.together.xyz/v1',
    requiresKey: true,
    supportsVision: true,
    keyPlaceholder: 'API key from together.ai',
    keyHelpUrl: 'https://api.together.ai/settings/api-keys',
    description: 'Open-weight models hosted at scale, some with vision.',
    models: [
      { id: 'meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo', label: 'Llama 3.2 90B Vision', description: 'Vision-capable' },
      { id: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', label: 'Llama 3.1 70B Turbo', description: 'Text only', supportsVision: false },
      { id: 'Qwen/Qwen2.5-72B-Instruct-Turbo', label: 'Qwen 2.5 72B', description: 'Text only', supportsVision: false },
    ],
  },
  {
    id: 'fireworks',
    label: 'Fireworks AI',
    shortLabel: 'Fireworks',
    apiFormat: 'openai',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    requiresKey: true,
    supportsVision: true,
    keyPlaceholder: 'fw_...',
    keyHelpUrl: 'https://fireworks.ai/account/api-keys',
    description: 'Fast hosted open-weight models with a free tier.',
    models: [
      { id: 'accounts/fireworks/models/llama-v3p2-90b-vision-instruct', label: 'Llama 3.2 90B Vision', description: 'Vision-capable' },
      { id: 'accounts/fireworks/models/llama-v3p3-70b-instruct', label: 'Llama 3.3 70B', description: 'Text only', supportsVision: false },
    ],
  },
  {
    id: 'deepinfra',
    label: 'DeepInfra',
    shortLabel: 'DeepInfra',
    apiFormat: 'openai',
    baseUrl: 'https://api.deepinfra.com/v1/openai',
    requiresKey: true,
    supportsVision: true,
    keyPlaceholder: 'API key from deepinfra.com',
    keyHelpUrl: 'https://deepinfra.com/dash/api_keys',
    description: 'Pay-as-you-go hosting for open-weight models.',
    models: [
      { id: 'meta-llama/Llama-3.2-90B-Vision-Instruct', label: 'Llama 3.2 90B Vision', description: 'Vision-capable' },
      { id: 'meta-llama/Meta-Llama-3.1-70B-Instruct', label: 'Llama 3.1 70B', description: 'Text only', supportsVision: false },
    ],
  },
  {
    id: 'perplexity',
    label: 'Perplexity',
    shortLabel: 'Perplexity',
    apiFormat: 'openai',
    baseUrl: 'https://api.perplexity.ai',
    requiresKey: true,
    supportsVision: false,
    keyPlaceholder: 'pplx-...',
    keyHelpUrl: 'https://www.perplexity.ai/settings/api',
    description: 'Search-grounded answers. Text only — no photo logging.',
    models: [
      { id: 'sonar', label: 'Sonar', description: 'Fast, web-grounded' },
      { id: 'sonar-pro', label: 'Sonar Pro', description: 'Higher quality, web-grounded' },
    ],
  },
  {
    id: 'custom',
    label: 'Custom Endpoint',
    shortLabel: 'Custom',
    apiFormat: 'openai',
    baseUrl: '', // user-supplied at runtime, see storage.getCustomBaseUrl()
    requiresKey: false,
    supportsVision: true,
    keyPlaceholder: 'Optional, depends on your endpoint',
    description: 'Any OpenAI-compatible endpoint — Ollama, LM Studio, self-hosted, etc.',
    models: [
      { id: 'default', label: 'Custom model', description: 'Type the exact model name your endpoint expects' },
    ],
  },
];

const providerMap: Record<string, ProviderDef> = Object.fromEntries(AI_PROVIDERS.map((p) => [p.id, p]));

export function getProviderDef(providerId: string): ProviderDef {
  const found = providerMap[providerId];
  if (found) return found;
  // Fall back to the first provider rather than throwing — keeps the UI resilient
  // if a stored provider id ever goes stale (e.g. after a provider is removed).
  return AI_PROVIDERS[0];
}

export function getDefaultModelFor(providerId: string): string {
  const def = getProviderDef(providerId);
  return def.models[0]?.id || '';
}

export function modelSupportsVision(providerId: string, modelId: string): boolean {
  const def = getProviderDef(providerId);
  const model = def.models.find((m) => m.id === modelId);
  if (model && typeof model.supportsVision === 'boolean') return model.supportsVision;
  return def.supportsVision;
}
