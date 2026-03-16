import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readSource(relativePath: string) {
  const absolutePath = resolve(process.cwd(), relativePath);
  return readFileSync(absolutePath, 'utf8');
}

describe('mobile ui regressions', () => {
  it('loads primeicons css explicitly', () => {
    const nuxtConfig = readSource('nuxt.config.ts');

    expect(nuxtConfig).toContain("'primeicons/primeicons.css'");
  });

  it('protects sources and campaigns routes when disconnected', () => {
    const routingMiddleware = readSource('src/middleware/routing.global.ts');

    expect(routingMiddleware).toContain('const protectedPaths = [');
    expect(routingMiddleware).toContain("'/sources'");
    expect(routingMiddleware).toContain("'/campaigns'");
    expect(routingMiddleware).toContain('if (!session && protectedPaths.some((path) => to.path.startsWith(path)))');
    expect(routingMiddleware).toContain("return navigateTo({ name: 'auth-login' });");
  });

  it('shows Sources in mobile burger menu', () => {
    const appHeader = readSource('src/components/AppHeader.vue');

    expect(appHeader).toContain(":label=\"$t('common.sources')\"");
    expect(appHeader).toContain('navigateTo(sourcesPath);');
  });

  it('uses compact contact count in table header on mobile', () => {
    const miningTable = readSource('src/components/mining/table/MiningTable.vue');

    expect(miningTable).toContain('formatContactsCountForHeader');
    expect(miningTable).toContain("notation: 'compact'");
    expect(miningTable).toContain('class="mx-2 leading-none"');
    expect(miningTable).toContain('class="ml-auto flex items-center gap-1 shrink-0"');
  });

  it('uses a single export menu button on mobile', () => {
    const exportContacts = readSource(
      'src/components/mining/buttons/ExportContacts.vue',
    );

    expect(exportContacts).toContain('<template v-if="$screenStore.size.md">');
    expect(exportContacts).toContain('<Menu ref="mobileExportMenu" :model="mobileExportItems" popup />');
    expect(exportContacts).toContain('@click="toggleMobileExportMenu"');
  });

  it('hides fullscreen action on mobile', () => {
    const miningTable = readSource('src/components/mining/table/MiningTable.vue');

    expect(miningTable).toContain('class="hidden md:block"');
  });

  it('prevents campaign card header overflow on mobile', () => {
    const campaignsPage = readSource('src/pages/campaigns.vue');

    expect(campaignsPage).toContain('flex-col sm:flex-row');
    expect(campaignsPage).toContain('flex-wrap sm:flex-nowrap');
    expect(campaignsPage).toContain('min-w-0');
  });
});
