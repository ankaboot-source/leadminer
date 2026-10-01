import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string) {
  const absolutePath = path.resolve(__dirname, '../../..', relativePath);
  return fs.readFileSync(absolutePath, 'utf-8');
}

const promptPath = 'src/components/mining/PassiveMiningDialog.vue';
const dialogPath = 'src/components/mining/PassiveMiningFolderDialog.vue';
const treePath =
  'src/components/mining/stepper-panels/mine/EmailFoldersTree.vue';

describe('post-mining passive mining prompt', () => {
  it('offers only the folders mined by the run, never the mailbox tree', () => {
    const prompt = readSource(promptPath);

    expect(prompt).not.toContain('$leadminerStore.boxes');
    expect(prompt).toContain('$leadminerStore.lastRunEmailFolders');
    expect(prompt).toContain(':checked="runFolders"');
    // A flat node list: no children, so the tree renders as a plain list.
    expect(prompt).toContain('runFolders.value.map((key) => ({');
    expect(prompt).not.toContain('children:');
  });

  it('badges folders that passive mining does not watch yet', () => {
    const prompt = readSource(promptPath);
    const dialog = readSource(dialogPath);
    const tree = readSource(treePath);

    expect(prompt).toContain(':new-folders="newFolders"');
    expect(prompt).toContain(
      'return runFolders.value.filter((key) => !registered.has(key));',
    );

    expect(dialog).toContain('newFolders?: string[]');
    expect(dialog).toContain(':marked-keys="newFolders"');
    expect(dialog).toContain(`:marked-label="t('folder_new_this_mining')"`);
    expect(dialog).toMatch(/"en"\s*:\s*\{[\s\S]*"folder_new_this_mining"\s*:/);
    expect(dialog).toMatch(/"fr"\s*:\s*\{[\s\S]*"folder_new_this_mining"\s*:/);
    // The bare «New» chip the user could not parse is gone for good.
    expect(dialog).not.toContain('"folders_new"');

    expect(tree).toContain('markedKeys?: string[]');
    expect(tree).toContain('markedLabel?: string');
    expect(tree).toContain('v-if="isMarked(node.key)"');
  });

  it('leaves the sources-page toggle on the full mailbox tree', () => {
    const sourcesPage = readSource('src/pages/sources.vue');

    expect(sourcesPage).toContain(':boxes="passiveDialogBoxes"');
    expect(sourcesPage).not.toContain(':new-folders=');
  });

  it('exposes the folders of the last run from the mining store', () => {
    const store = readSource('src/stores/leadminer.ts');

    expect(store).toMatch(/return \{[\s\S]*\blastRunEmailFolders\b[\s\S]*\};/);
  });
});
