/**
 * Signature Extraction Benchmark – Multi-Model Evaluation
 *
 * This script runs a benchmark to evaluate the signature extraction capabilities
 * of multiple Large Language Models (LLMs) against a set of predefined test cases.
 *
 * It calculates:
 * - Weighted accuracy per model.
 * - Detailed failure cases per field.
 * - Global dataset statistics.
 *
 * The final results are written to a file named './results.txt'.
 *
 * How to run:
 * - Ensure your OpenRouter API key is set in your environment variables.
 * - create your test cases following :
 * - Run the file using `npx ts-node test/unit/email-signature/benchmark-signature-llm.ts`.
 */

/* eslint-disable no-console, no-await-in-loop */

import { Logger } from 'winston';
import { writeFileSync } from 'fs';
import { SignatureLLM } from '../../../src/services/signature/llm';
import { TokenBucketRateLimiter } from '../../../src/services/rate-limiter/RateLimiter';
import { LLMModelsList } from '../../../src/services/signature/llm/types';
import { PersonLD } from '../../../src/services/signature/types';

const apiKey: string | undefined = process.env.SIGNATURE_OPENROUTER_API_KEY;

if (!apiKey) {
  console.error(
    'ERROR: OpenRouter API key is not set. Please set the apiKey variable.'
  );
  process.exit(1);
}

const RESULT_FILE = './results.txt';

const MODELS = [...LLMModelsList];

const TEST_CASES: Array<{
  name: string;
  input: string;
  email: string;
  expected: null | PersonLD;
}> = [
  {
    name: 'Standard-Modern-LinkedIn',
    input:
      'Best regards,\n\nEvelyn Reed\nSenior Product Manager\nTechForge Solutions\n[LinkedIn Icon] linkedin.com/in/evelynreed\n(800) 555-1212 x345\nwww.techforgesolutions.com',
    expected: {
      name: 'Evelyn Reed',
      address: undefined,
      jobTitle: 'Senior Product Manager',
      sameAs: ['https://linkedin.com/in/evelynreed'],
      worksFor: 'TechForge Solutions',
      telephone: ['+18005551212 x345']
    },
    email: 'test@techforgesolutions.com'
  },
  {
    name: 'Complex-Multi-Contact-Address',
    input:
      'Warmly,\n\nDr. Marcus V. Alistair\nChief Financial Officer (CFO)\n\nAscend Capital Group\nDirect: +44 20 7946 0999 | Mobile: +44 7700 900888\n\n14 Victoria Street, Westminster\nLondon, SW1H 0AP, United Kingdom',
    expected: {
      name: 'Dr. Marcus V. Alistair',
      address:
        '14 Victoria Street, Westminster, London, SW1H 0AP, United Kingdom',
      jobTitle: 'Chief Financial Officer (CFO)',
      sameAs: undefined,
      worksFor: 'Ascend Capital Group',
      telephone: ['+442079460999', '+447700900888']
    },
    email: 'drmarcus@gmail.com'
  }
  // Add more test cases here to build a robust benchmark dataset
];

type FieldName =
  | 'name'
  | 'worksFor'
  | 'telephone'
  | 'address'
  | 'jobTitle'
  | 'sameAs';

const FIELDS: FieldName[] = [
  'name',
  'worksFor',
  'telephone',
  'address',
  'jobTitle',
  'sameAs'
];

const FIELD_WEIGHTS = {
  telephone: 3,
  address: 4,
  name: 1,
  worksFor: 2,
  jobTitle: 2,
  sameAs: 1
} as const;

const DATASET_STATS = {
  totalCases: TEST_CASES.length,
  withName: 0,
  withTelephone: 0,
  withAddress: 0,
  withJobTitle: 0,
  withWorksFor: 0,
  withSocial: 0
};

for (const tc of TEST_CASES) {
  const e = tc.expected ?? {};

  if (e.name) DATASET_STATS.withName += 1;
  if (e.telephone) DATASET_STATS.withTelephone += 1;
  if (e.address) DATASET_STATS.withAddress += 1;
  if (e.jobTitle) DATASET_STATS.withJobTitle += 1;
  if (e.worksFor) DATASET_STATS.withWorksFor += 1;
  if (Array.isArray(e.sameAs) && e.sameAs.length > 0)
    DATASET_STATS.withSocial += 1;
}

type ModelStat = {
  totalWeight: number;
  score: number;
  failures: Array<{
    test: string;
    signature: string;
    field: string;
    expected: unknown;
    received: unknown;
  }>;
};

const modelStats = new Map<string, ModelStat>();

const getMockLogger = () =>
  ({
    debug: () => {},
    error: console.error,
    info: console.log,
    warn: console.warn,
    log: () => {}
  }) as unknown as Logger;

const sortPrimitiveArrays = (
  obj: string | string[] | undefined
): string | string[] | undefined => {
  if (Array.isArray(obj)) {
    return [...obj].sort();
  }

  return obj;
};

async function processInBatches<T>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchPromises = batch.map(processor);
    await Promise.all(batchPromises);
  }
}

function writeBenchmarkResults() {
  let output = '';

  output +=
    '\n================ SIGNATURE EXTRACTION BENCHMARK ================\n';
  output += `Date: ${new Date().toISOString()}\n`;

  output += '\n=== DATASET STATISTICS ===\n';
  output += `Total Test Cases: ${DATASET_STATS.totalCases}\n`;
  output += `With Name : ${DATASET_STATS.withName}\n`;
  output += `With Telephone : ${DATASET_STATS.withTelephone}\n`;
  output += `With Address   : ${DATASET_STATS.withAddress}\n`;
  output += `With Job Title : ${DATASET_STATS.withJobTitle}\n`;
  output += `With WorksFor  : ${DATASET_STATS.withWorksFor}\n`;
  output += `With Social    : ${DATASET_STATS.withSocial}\n`;

  output += '\n=== MODEL LEADERBOARD (by weighted accuracy) ===\n';

  const leaderboard = [...modelStats.entries()]
    .map(([model, stats]) => ({
      model,
      accuracy: stats.totalWeight > 0 ? stats.score / stats.totalWeight : 0,
      failures: stats.failures.length,
      stats
    }))
    .sort((a, b) => b.accuracy - a.accuracy);

  leaderboard.forEach((entry, i) => {
    output += `${i + 1}. ${entry.model.padEnd(28)} ${(
      entry.accuracy * 100
    ).toFixed(2)}%\n`;
  });

  for (const entry of leaderboard) {
    const { model, accuracy, stats } = entry;

    output += `\n\n### MODEL: ${model}\n`;
    output += `Accuracy: ${(accuracy * 100).toFixed(2)}%\n`;
    output += `Failures: ${stats.failures.length}\n`;

    if (stats.failures.length === 0) {
      output += 'Perfect extraction.\n';
      continue;
    }

    const failCount: Record<string, number> = {};
    for (const f of stats.failures) {
      failCount[f.field] = (failCount[f.field] ?? 0) + 1;
    }

    output += '\nField Failure Distribution:\n';
    const sortedFailCounts = Object.entries(failCount).sort(
      (a, b) => b[1] - a[1]
    );

    for (const [field, count] of sortedFailCounts) {
      output += `  - ${field}: ${count}\n`;
    }
  }

  for (const { model, stats } of leaderboard) {
    output += `\nMODEL: ${model} | Detailed Failures:\n`;
    for (const f of stats.failures) {
      output += `\n• Test: ${f.test}\n`;
      output += `  Signature: ${JSON.stringify(f.signature)}\n`;
      output += `  Field   : ${f.field}\n`;
      output += `  Expected: ${JSON.stringify(f.expected)}\n`;
      output += `  Received: ${JSON.stringify(f.received)}\n`;
    }
  }

  writeFileSync(RESULT_FILE, output, 'utf8');
  console.log(`\n📄 Benchmark results successfully written to ${RESULT_FILE}`);
}

async function runBenchmark() {
  console.log(
    `Starting Signature Extraction Benchmark with ${TEST_CASES.length} cases across ${MODELS.length} models...\n`
  );
  const logger = getMockLogger();

  for (const model of MODELS) {
    modelStats.set(model, {
      totalWeight: 0,
      score: 0,
      failures: []
    });
  }

  const rateLimiter = new TokenBucketRateLimiter(500, 60_000);

  for (const model of MODELS) {
    const stats = modelStats.get(model);

    if (!stats) continue;

    const llm = new SignatureLLM(
      rateLimiter,
      logger,
      [model],
      apiKey as string
    );

    try {
      await processInBatches(TEST_CASES, 10, async (tc) => {
        let result;
        try {
          const timeout = 60_000;
          const extractionPromise = llm.extract(tc.email, tc.input);
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(new Error('Extraction Timeout'));
            }, timeout);
          });

          result = await Promise.race([extractionPromise, timeoutPromise]);
          console.info(`✅ - ${model} - ${tc.name.padEnd(25)}`);
        } catch (error) {
          console.error(
            `❌ - ${model} - ${tc.name.padEnd(25)}: ${
              error instanceof Error ? error.message : String(error)
            })`
          );
          result = null;
        }

        for (const field of FIELDS) {
          const weight = FIELD_WEIGHTS[field] ?? 1;

          const expected = sortPrimitiveArrays(tc.expected?.[field]);
          const received = sortPrimitiveArrays(result?.[field]);

          stats.totalWeight += weight;

          const match =
            JSON.stringify(expected) === JSON.stringify(received) ||
            (expected == null && received == null);

          if (match) {
            stats.score += weight;
          } else if (received && expected && !match) {
            stats.score -= 10;
            stats.failures.push({
              test: tc.name,
              field,
              signature: tc.input,
              expected,
              received
            });
          } else {
            stats.failures.push({
              test: tc.name,
              field,
              signature: tc.input,
              expected,
              received
            });
          }
        }
      });
    } catch (error) {
      console.error(`\nCRITICAL ERROR for model ${model}:`, error);
    }
  }

  writeBenchmarkResults();
}

runBenchmark().catch((error) => {
  console.error('\nBenchmark failed with an unhandled exception:', error);
});
