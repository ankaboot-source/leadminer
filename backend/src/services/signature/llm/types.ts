/**
 * LLMModels (Open-source)
 *
 * Order reflects JSON accuracy, schema adherence, and consistency.
 * Use `LLMModelsList[index]` to pick by priority.
 *
 * Cheaper OpenRouter model IDs. Prefer `:free` variants where available to
 * keep signature extraction cost low; the worker rate-limiter already drops
 * to 15 requests/min when all configured models are free.
 */
export enum LLMModels {
  deepseekR1 = 'deepseek/deepseek-r1:free',
  zAiGlm45Air = 'z-ai/glm-4.5-air:free',
  gemma312b = 'google/gemma-3-12b-it:free',
  metaLlama33Instruct70b = 'meta-llama/llama-3.3-70b-instruct:free',
  nvidiaNemotronNano9bV2 = 'nvidia/nemotron-nano-9b-v2:free'
}

export type LLMModelType = `${LLMModels}`;

export const LLMModelsList = Object.values(LLMModels);
