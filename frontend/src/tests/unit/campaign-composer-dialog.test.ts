import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string) {
  const absolutePath = path.resolve(__dirname, '../../..', relativePath);
  return fs.readFileSync(absolutePath, 'utf-8');
}

const composerPath = 'src/components/campaigns/CampaignComposerDialog.vue';

describe('email campaign composer dialog', () => {
  it('opens full screen by default through the PrimeVue maximize API', () => {
    const composer = readSource(composerPath);

    expect(composer).toContain('ref="composerDialogRef"');
    expect(composer).toMatch(
      /async function onDialogShow\(\) \{\s*composerDialogRef\.value\?\.maximize\?\.\(\);/,
    );
  });

  it('keeps the dialog maximizable so the composer can be restored', () => {
    const composer = readSource(composerPath);

    expect(composer).toContain(':maximizable="$screenStore?.size?.md"');
    // `maximized` is Dialog internal state, not a prop: passing it as a bare
    // attribute would leak an invalid DOM attribute onto the mask element.
    expect(composer).not.toMatch(/<Dialog[\s\S]*?\smaximized\s*\n/);
  });

  it('leaves the SMS and WhatsApp composers at their current size', () => {
    for (const dialog of [
      'src/components/campaigns/SmsCampaignComposerDialog.vue',
      'src/components/campaigns/WhatsAppCampaignComposerDialog.vue',
    ]) {
      const source = readSource(dialog);

      expect(source).not.toContain('maximize?.()');
      expect(source).toContain(
        ':pt:root:class="{ \'p-dialog-maximized\': !$screenStore?.size?.md }"',
      );
    }
  });
});
