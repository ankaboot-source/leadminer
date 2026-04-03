/**
 * LLMModels (Open-source)
 *
 * Order reflects JSON accuracy, schema adherence, and consistency.
 * Use `LLMModelsList[index]` to pick by priority.
 */
export enum LLMModels {
  xaiGrok4Fast = 'x-ai/grok-4-fast',
  anthropicClaude37Sonnet = 'anthropic/claude-3.7-sonnet',
  anthropicClaudeSonnet45 = 'anthropic/claude-sonnet-4.5',
  openaiGpt41Nano = 'openai/gpt-4.1-nano',
  anthropicClaude35Haiku = 'anthropic/claude-3.5-haiku'
}

export type LLMModelType = `${LLMModels}`;

export const LLMModelsList = Object.values(LLMModels);
