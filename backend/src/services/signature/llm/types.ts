export enum LLMModels {
  nvidiaLlama31NemotronUltra253bV1 = "nvidia/llama-3.1-nemotron-ultra-253b-v1",
  openaiGptOss120b = "openai/gpt-oss-120b",
  deepseekR1 = "deepseek/deepseek-r1",
  deepcogitoCogitoV2PreviewLlama109bMoe = "deepcogito/cogito-v2-preview-llama-109b-moe",
  zAiGlm46 = "z-ai/glm-4.6",
  openaiGptOss20b = "openai/gpt-oss-20b",
}

export type LLMModelType = `${LLMModels}`;

export const LLMModelsList = Object.values(LLMModels);