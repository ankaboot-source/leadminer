import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import CampaignsSkeleton from '@/components/campaigns-skeleton.vue';

describe('CampaignsSkeleton', () => {
  it('renders 3 skeleton cards with correct structure', () => {
    const wrapper = mount(CampaignsSkeleton);

    // Should render 3 skeleton cards
    expect(wrapper.findAll('[data-testid="skeleton-card"]')).toHaveLength(3);

    // Each card should have header skeleton (2 skeletons)
    const headerSkeletons = wrapper.findAll('[data-testid="header-skeleton"]');
    expect(headerSkeletons).toHaveLength(6); // 3 cards * 2 skeletons each

    // Each card should have actions skeleton (3 skeletons)
    const actionsSkeletons = wrapper.findAll(
      '[data-testid="actions-skeleton"]',
    );
    expect(actionsSkeletons).toHaveLength(9); // 3 cards * 3 skeletons each

    // Each card should have 5 metric placeholders
    const metricSkeletons = wrapper.findAll('[data-testid="metric-skeleton"]');
    expect(metricSkeletons).toHaveLength(15); // 3 cards * 5 metrics each
  });

  it('renders correct skeleton dimensions based on sources.vue pattern', () => {
    const wrapper = mount(CampaignsSkeleton);

    // Check header skeleton dimensions
    const headerSkeletons = wrapper.findAll('[data-testid="header-skeleton"]');
    expect(headerSkeletons[0].attributes('style')).toContain(
      'width: 8rem; height: 1rem',
    );
    expect(headerSkeletons[1].attributes('style')).toContain(
      'width: 14rem; height: 0.85rem',
    );

    // Check actions skeleton dimensions
    const actionsSkeletons = wrapper.findAll(
      '[data-testid="actions-skeleton"]',
    );
    expect(actionsSkeletons[0].attributes('style')).toContain(
      'width: 5.5rem; height: 2rem',
    );
    expect(actionsSkeletons[1].attributes('style')).toContain(
      'width: 2.8rem; height: 1.6rem',
    );
    expect(actionsSkeletons[2].attributes('style')).toContain(
      'width: 5.2rem; height: 1.75rem',
    );

    // Check metric skeleton dimensions
    const metricSkeletons = wrapper.findAll('[data-testid="metric-skeleton"]');
    expect(metricSkeletons[0].attributes('style')).toContain('height: 4.5rem');
  });
});
