import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readFrontendSource(relativePath: string) {
  const absolutePath = path.resolve(__dirname, '../../..', relativePath);
  return fs.readFileSync(absolutePath, 'utf-8');
}

function readRepoSource(relativePath: string) {
  const absolutePath = path.resolve(__dirname, '../../../..', relativePath);
  return fs.readFileSync(absolutePath, 'utf-8');
}

describe('mining and campaign regressions', () => {
  it('does not require an active email source when starting file mining', () => {
    const importFileDialog = readFrontendSource(
      'src/components/mining/stepper-panels/source/ImportFileDialog.vue',
    );

    expect(importFileDialog).not.toContain(
      'const activeSource = $leadminerStore.activeMiningSource;',
    );
    expect(importFileDialog).not.toContain('if (!activeSource) return;');
  });

  it('includes go_to_sources translation keys for both locales', () => {
    const campaignComposer = readFrontendSource(
      'src/components/campaigns/CampaignComposerDialog.vue',
    );

    expect(campaignComposer).toMatch(/"en"\s*:\s*\{[\s\S]*"go_to_sources"\s*:/);
    expect(campaignComposer).toMatch(/"fr"\s*:\s*\{[\s\S]*"go_to_sources"\s*:/);
  });

  it('uses short unsubscribe links in campaign preview payload', () => {
    const emailCampaignsFunction = readRepoSource(
      'supabase/functions/email-campaigns/index.ts',
    );

    const previewStart = emailCampaignsFunction.indexOf(
      'app.post("/campaigns/preview"',
    );
    const previewEnd = emailCampaignsFunction.indexOf('/campaigns/create');
    expect(previewStart).toBeGreaterThanOrEqual(0);
    expect(previewEnd).toBeGreaterThan(previewStart);
    const previewBlock = emailCampaignsFunction.slice(previewStart, previewEnd);

    expect(previewBlock).toContain('unsubscribeUrl: buildUnsubscribeUrl(');
    expect(previewBlock).not.toContain('/unsubscribe/success');
  });
});
