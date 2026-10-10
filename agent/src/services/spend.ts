import type { Env } from "../env";
import type { ProviderResult } from "../providers/llm";

function requiredRate(value: string | undefined, name: string): number {
  const parsed = Number(value);
  if (!value || !Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`LLM spend tracking setup required: configure ${name} using the provider's current published rate.`);
  }
  return parsed;
}

export type UsageReservation = {
  id: string;
  estimatedCostUsd: number;
  inputTokens: number;
  outputTokens: number;
};

export async function reserveProviderUsage(
  env: Env,
  provider: string,
  prompt: string,
  maximumOutputTokens = 2048,
): Promise<UsageReservation> {
  if (provider === "openai" && (!env.OPENAI_API_KEY || !env.OPENAI_MODEL)) {
    throw new Error("LLM setup required: configure OPENAI_API_KEY and OPENAI_MODEL.");
  }
  const inputTokens = provider === "mock" ? 0 : Math.ceil(new TextEncoder().encode(prompt).length / 2) + 256;
  const outputTokens = provider === "mock" ? 0 : maximumOutputTokens;
  const inputRate = provider === "mock" ? 0 : requiredRate(env.LLM_INPUT_USD_PER_1K_TOKENS, "LLM_INPUT_USD_PER_1K_TOKENS");
  const outputRate = provider === "mock" ? 0 : requiredRate(env.LLM_OUTPUT_USD_PER_1K_TOKENS, "LLM_OUTPUT_USD_PER_1K_TOKENS");
  const estimatedCost = inputTokens * inputRate / 1000 + outputTokens * outputRate / 1000;

  const id = crypto.randomUUID();
  const reserved = await env.DB.prepare(
    `INSERT INTO provider_usage (id, provider, model, input_tokens, output_tokens, estimated_cost_usd)
     SELECT ?, ?, ?, ?, ?, ?
     WHERE EXISTS (
       SELECT 1 FROM settings s
       WHERE s.id = 1
         AND COALESCE((SELECT SUM(estimated_cost_usd) FROM provider_usage WHERE created_at >= date('now')), 0) + ? <= s.daily_spend_cap_usd
         AND COALESCE((SELECT SUM(estimated_cost_usd) FROM provider_usage WHERE created_at >= date('now', 'start of month')), 0) + ? <= s.monthly_spend_cap_usd
     )`,
  ).bind(
    id,
    provider,
    provider === "mock" ? "mock" : env.OPENAI_MODEL ?? "unconfigured",
    inputTokens,
    outputTokens,
    estimatedCost,
    estimatedCost,
    estimatedCost,
  ).run();
  if (reserved.meta.changes !== 1) {
    throw new Error("Daily or monthly LLM spend cap would be exceeded; generation was blocked.");
  }
  return { id, estimatedCostUsd: estimatedCost, inputTokens, outputTokens };
}

export async function settleProviderUsage(env: Env, reservation: UsageReservation, result: ProviderResult): Promise<void> {
  const inputRate = result.provider === "mock" ? 0 : requiredRate(env.LLM_INPUT_USD_PER_1K_TOKENS, "LLM_INPUT_USD_PER_1K_TOKENS");
  const outputRate = result.provider === "mock" ? 0 : requiredRate(env.LLM_OUTPUT_USD_PER_1K_TOKENS, "LLM_OUTPUT_USD_PER_1K_TOKENS");
  const actualCost = result.inputTokens * inputRate / 1000 + result.outputTokens * outputRate / 1000;
  await env.DB.prepare(
    "UPDATE provider_usage SET model = ?, input_tokens = ?, output_tokens = ?, estimated_cost_usd = ? WHERE id = ?",
  ).bind(result.model, result.inputTokens, result.outputTokens, actualCost, reservation.id).run();
}
