/**
 * LLMModels (Open-source)
 *
 * Order reflects JSON accuracy, schema adherence, and consistency.
 * Use `LLMModelsList[index]` to pick by priority.
 */
export enum LLMModels {
  nvidiaNemotronNano9bV2 = 'nvidia/nemotron-nano-9b-v2:free',
  deepseekR1 = 'deepseek/deepseek-r1:free',
  zAiGlm45Air = 'z-ai/glm-4.5-air:free',
  metaLlama33Instruct70b = 'meta-llama/llama-3.3-70b-instruct:free',
  openaiGptOss20b = 'openai/gpt-oss-20b:free'
}

export type LLMModelType = `${LLMModels}`;

export const LLMModelsList = Object.values(LLMModels);
