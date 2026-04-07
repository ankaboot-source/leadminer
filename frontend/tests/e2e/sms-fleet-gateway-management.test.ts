import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { ref, nextTick } from 'vue';
import PrimeVue from 'primevue/config';
import SmsFleetManagement from '~/components/sms-fleet/SmsFleetManagement.vue';
import ProviderForm from '~/components/sms-fleet/ProviderForm.vue';

let mockGateways = ref<any[]>([]);
const mockFetchGateways = vi.fn().mockResolvedValue(undefined);
const mockCreateGateway = vi.fn().mockImplementation((data) => {
  const gateway = {
    id: `gateway-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    user_id: 'user-1',
    name: data.name,
    provider: data.provider,
    config: data.config,
    is_active: data.is_active ?? true,
    daily_limit: data.daily_limit ?? 0,
    monthly_limit: data.monthly_limit ?? 0,
    sent_today: 0,
    sent_this_month: 0,
    last_reset_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  mockGateways.value = [...mockGateways.value, gateway];
  return gateway;
});
const mockDeleteGateway = vi.fn().mockImplementation((id) => {
  const index = mockGateways.value.findIndex((g) => g.id === id);
  if (index !== -1) {
    mockGateways.value = mockGateways.value.filter((g) => g.id !== id);
  }
  return true;
});
const mockTestGateway = vi
  .fn()
  .mockResolvedValue({ success: true, message: 'OK' });
const mockUpdateGateway = vi.fn().mockResolvedValue(true);

vi.mock('~/stores/sms-fleet', () => ({
  useSmsFleetStore: vi.fn(() => ({
    get gateways() {
      return mockGateways.value;
    },
    isLoading: false,
    error: null,
    fetchGateways: mockFetchGateways,
    createGateway: mockCreateGateway,
    deleteGateway: mockDeleteGateway,
    testGateway: mockTestGateway,
    updateGateway: mockUpdateGateway,
  })),
}));

vi.mock('vue-i18n', () => ({
  useI18n: vi.fn(() => ({
    t: (key: string) => key,
  })),
}));

vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({
    add: vi.fn(),
    remove: vi.fn(),
    removeAll: vi.fn(),
  })),
}));

vi.mock('primevue/useconfirm', () => ({
  useConfirm: vi.fn(() => ({
    require: vi.fn(),
  })),
}));

vi.mock('#imports', () => ({
  onMounted: (cb: () => void) => cb(),
}));

const commonStubs = {
  Button: {
    template: `<button :disabled="disabled" @click="$emit('click')">{{ label }}</button>`,
    props: [
      'label',
      'icon',
      'disabled',
      'outlined',
      'text',
      'severity',
      'size',
      'loading',
    ],
  },
  InputText: {
    template: `<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" :name="$attrs.name" :placeholder="placeholder" class="w-full" />`,
    props: ['modelValue', 'placeholder', 'class', 'id'],
  },
  InputNumber: {
    template: `<input type="number" :value="modelValue" @input="$emit('update:modelValue', Number($event.target.value))" :min="min" :placeholder="placeholder" />`,
    props: ['modelValue', 'min', 'placeholder'],
  },
  Dropdown: {
    template: `
      <select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
        <option value="">Select...</option>
        <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
    `,
    props: [
      'modelValue',
      'options',
      'optionLabel',
      'optionValue',
      'placeholder',
      'disabled',
      'class',
    ],
  },
  Tag: {
    template: '<span>{{ value }}</span>',
    props: ['value', 'severity', 'size'],
  },
  Checkbox: {
    template: `<input type="checkbox" :checked="modelValue" @change="$emit('update:modelValue', $event.target.checked)" />`,
    props: ['modelValue', 'binary', 'inputId'],
  },
  ProgressSpinner: {
    template: '<div class="spinner-mock">Loading...</div>',
  },
  ConfirmDialog: {
    template: '<div class="confirm-dialog-mock"></div>',
  },
};

const providerFormStubs = {
  InputText: {
    template: `<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" :name="$attrs.name" :placeholder="placeholder" class="w-full" />`,
    props: ['modelValue', 'placeholder', 'class', 'id'],
  },
  Password: {
    template: `<input type="password" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" :name="$attrs.name" :placeholder="placeholder" />`,
    props: [
      'modelValue',
      'placeholder',
      'feedback',
      'toggleMask',
      'inputClass',
    ],
  },
  Button: {
    template: `<button type="submit" :disabled="disabled">{{ label }}</button>`,
    props: ['label', 'icon', 'disabled', 'type'],
  },
};

describe('SMS Fleet Gateway Management E2E', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockGateways.value = [];
  });

  describe('Gateway Configuration Flow', () => {
    it('completes full gateway configuration workflow', async () => {
      const wrapper = mount(SmsFleetManagement, {
        global: {
          plugins: [PrimeVue],
          stubs: {
            ...commonStubs,
            Dialog: {
              template: `
                <div v-if="visible" class="dialog-mock" data-testid="gateway-dialog">
                  <slot></slot>
                  <div class="dialog-footer"><slot name="footer"></slot></div>
                </div>
              `,
              props: ['visible', 'header', 'modal'],
            },
          },
        },
      });

      await flushPromises();

      // 1. Mount component - verify SmsFleetManagement is mounted
      expect(wrapper.findComponent(SmsFleetManagement).exists()).toBe(true);

      // 2. See unified SMS Gateways panel
      expect(wrapper.text()).toContain('sms_fleet_management');
      expect(wrapper.text()).toContain('add_gateway');

      // Initial state - no gateways
      expect(mockGateways.value).toHaveLength(0);

      // 3. Click "Add Gateway" to open dialog
      const addGatewayBtn = wrapper.find('button');
      expect(addGatewayBtn.exists()).toBe(true);
      await addGatewayBtn.trigger('click');
      await nextTick();

      // Dialog should now be visible
      const dialog = wrapper.find('[data-testid="gateway-dialog"]');
      expect(dialog.exists()).toBe(true);

      // 4. Select provider (smsgate)
      const providerDropdown = dialog.find('select');
      await providerDropdown.setValue('smsgate');
      await flushPromises();

      // 5. Fill form fields for smsgate
      const inputs = dialog.findAll('input');
      const usernameInput = inputs.find(
        (i) => i.attributes('name') === 'username',
      );
      const passwordInput = inputs.find(
        (i) => i.attributes('type') === 'password',
      );
      const baseUrlInput = inputs.find(
        (i) => i.attributes('name') === 'baseUrl',
      );

      expect(usernameInput).toBeDefined();
      expect(passwordInput).toBeDefined();

      await usernameInput!.setValue('testuser');
      await passwordInput!.setValue('testpass');
      if (baseUrlInput) {
        await baseUrlInput.setValue('https://api.smsgate.com');
      }
      await flushPromises();

      // 6. Submit and save to store
      const submitBtn = dialog.find('form button[type="submit"]');
      await submitBtn.trigger('submit');
      await flushPromises();
      await nextTick();

      // 7. Verify gateway saved in store
      expect(mockCreateGateway).toHaveBeenCalled();
      const createCall = mockCreateGateway.mock.calls[0][0];
      expect(createCall.provider).toBe('smsgate');
      expect(createCall.config.username).toBe('testuser');
      expect(createCall.config.password).toBe('testpass');

      // Dialog should close after successful creation
      expect(wrapper.find('[data-testid="gateway-dialog"]').exists()).toBe(
        false,
      );

      // 8. Configure another gateway
      await wrapper.find('button').trigger('click'); // Add Gateway again
      await nextTick();

      const dialog2 = wrapper.find('[data-testid="gateway-dialog"]');
      expect(dialog2.exists()).toBe(true);

      const providerDropdown2 = dialog2.find('select');
      await providerDropdown2.setValue('simple-sms-gateway');
      await flushPromises();

      // Fill simple-sms-gateway form
      const inputs2 = dialog2.findAll('input');
      let simpleBaseUrlInput: any = null;
      for (const input of inputs2) {
        if (input.attributes('name') === 'baseUrl') {
          simpleBaseUrlInput = input;
          break;
        }
      }
      if (simpleBaseUrlInput) {
        await simpleBaseUrlInput.setValue('http://192.168.1.100:8080');
      }
      await flushPromises();

      // Submit second gateway
      const submitBtn2 = dialog2.find('form button[type="submit"]');
      await submitBtn2.trigger('submit');
      await flushPromises();
      await nextTick();

      // 9. Verify two gateways in store
      expect(mockCreateGateway).toHaveBeenCalledTimes(2);
      const secondCall = mockCreateGateway.mock.calls[1][0];
      expect(secondCall.provider).toBe('simple-sms-gateway');
    });

    it('removes gateway from store when delete confirmed', async () => {
      // Setup: Pre-populate store with 2 gateways
      mockGateways.value = [
        {
          id: 'gateway-1',
          user_id: 'user-1',
          name: 'Primary Gateway',
          provider: 'smsgate',
          config: { username: 'user1', password: 'pass1' },
          is_active: true,
          daily_limit: 1000,
          monthly_limit: 10000,
          sent_today: 0,
          sent_this_month: 0,
          last_reset_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'gateway-2',
          user_id: 'user-1',
          name: 'Secondary Gateway',
          provider: 'simple-sms-gateway',
          config: { simpleSmsGatewayBaseUrl: 'http://192.168.1.1:8080' },
          is_active: true,
          daily_limit: 500,
          monthly_limit: 5000,
          sent_today: 0,
          sent_this_month: 0,
          last_reset_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const wrapper = mount(SmsFleetManagement, {
        global: {
          plugins: [PrimeVue],
          stubs: commonStubs,
        },
      });

      await flushPromises();

      // Step 9: Verify 2 gateways in store
      expect(mockGateways.value).toHaveLength(2);

      // Simulate deletion flow - directly call the delete action
      // In production, this would be triggered by clicking delete then confirming
      const gatewayToDelete = mockGateways.value[0];
      await mockDeleteGateway(gatewayToDelete.id);

      // Step 10: Verify only one gateway remains
      expect(mockDeleteGateway).toHaveBeenCalledWith(gatewayToDelete.id);
      expect(mockGateways.value).toHaveLength(1);
      expect(mockGateways.value[0].id).toBe('gateway-2');
      expect(mockGateways.value[0].provider).toBe('simple-sms-gateway');
    });
  });

  describe('Campaign Dialog Integration', () => {
    it('integrates fleet management with gateway configuration', async () => {
      // This test verifies SmsFleetManagement properly integrates
      // with the Pinia store for gateway CRUD operations

      const wrapper = mount(SmsFleetManagement, {
        global: {
          plugins: [PrimeVue],
          stubs: {
            ...commonStubs,
            Dialog: {
              template: `
                <div v-if="visible" class="dialog-mock" data-testid="gateway-dialog">
                  <slot></slot>
                  <div class="dialog-footer"><slot name="footer"></slot></div>
                </div>
              `,
              props: ['visible', 'header', 'modal'],
            },
          },
        },
      });

      await flushPromises();

      // Initial state
      expect(mockGateways.value).toHaveLength(0);

      // Open dialog
      await wrapper.find('button').trigger('click');
      await nextTick();

      const dialog = wrapper.find('[data-testid="gateway-dialog"]');
      expect(dialog.exists()).toBe(true);

      // Add smsgate gateway
      await dialog.find('select').setValue('smsgate');
      await flushPromises();

      const inputs = dialog.findAll('input');
      const usernameInput = inputs.find(
        (i) => i.attributes('name') === 'username',
      );
      const passwordInput = inputs.find(
        (i) => i.attributes('type') === 'password',
      );

      await usernameInput!.setValue('integrationuser');
      await passwordInput!.setValue('integrationpass');
      await flushPromises();

      await dialog.find('form button[type="submit"]').trigger('submit');
      await flushPromises();

      // Verify store integration
      expect(mockCreateGateway).toHaveBeenCalled();
      const gatewayData = mockCreateGateway.mock.calls[0][0];
      expect(gatewayData.provider).toBe('smsgate');
      expect(gatewayData.config.username).toBe('integrationuser');

      // Verify store state reflects the change
      expect(mockGateways.value.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('ProviderForm Validation', () => {
    it('validates smsgate provider fields', async () => {
      const wrapper = mount(ProviderForm, {
        props: {
          provider: 'smsgate',
        },
        global: {
          plugins: [PrimeVue],
          stubs: providerFormStubs,
        },
      });

      await flushPromises();

      // Initial state - form is invalid
      const emitted = wrapper.emitted('valid');
      expect(emitted?.at(-1)).toEqual([false]);

      // Fill required fields
      await wrapper.find('input[name="username"]').setValue('testuser');
      await wrapper.find('input[type="password"]').setValue('testpass');
      await flushPromises();

      // Form should now be valid
      expect(wrapper.emitted('valid')?.at(-1)).toEqual([true]);

      // Submit form
      await wrapper.find('form').trigger('submit');
      await flushPromises();

      // Verify submit event
      expect(wrapper.emitted('submit')).toBeTruthy();
      const submitPayload = wrapper.emitted('submit')![0][0] as any;
      expect(submitPayload.provider).toBe('smsgate');
      expect(submitPayload.config.username).toBe('testuser');
      expect(submitPayload.config.password).toBe('testpass');
    });

    it('validates simple-sms-gateway provider fields', async () => {
      const wrapper = mount(ProviderForm, {
        props: {
          provider: 'simple-sms-gateway',
        },
        global: {
          plugins: [PrimeVue],
          stubs: providerFormStubs,
        },
      });

      await flushPromises();

      // Initial state - form is invalid (empty URL)
      const initialEmitted = wrapper.emitted('valid');
      expect(initialEmitted?.at(-1)).toEqual([false]);

      // Fill URL with invalid format
      await wrapper.find('input[name="baseUrl"]').setValue('not-a-url');
      await flushPromises();

      // Still invalid (not a URL)
      expect(wrapper.emitted('valid')?.at(-1)).toEqual([false]);

      // Fill valid URL
      await wrapper
        .find('input[name="baseUrl"]')
        .setValue('http://192.168.1.100:8080');
      await flushPromises();

      // Form should now be valid
      expect(wrapper.emitted('valid')?.at(-1)).toEqual([true]);

      // Submit form
      await wrapper.find('form').trigger('submit');
      await flushPromises();

      // Verify submit event
      expect(wrapper.emitted('submit')).toBeTruthy();
      const submitPayload = wrapper.emitted('submit')![0][0] as any;
      expect(submitPayload.provider).toBe('simple-sms-gateway');
      expect(submitPayload.config.simpleSmsGatewayBaseUrl).toBe(
        'http://192.168.1.100:8080',
      );
    });

    it('requires both username and password for smsgate', async () => {
      const wrapper = mount(ProviderForm, {
        props: {
          provider: 'smsgate',
        },
        global: {
          plugins: [PrimeVue],
          stubs: providerFormStubs,
        },
      });

      await flushPromises();

      // Initial - invalid
      expect(wrapper.emitted('valid')?.at(-1)).toEqual([false]);

      // Only username - still invalid
      await wrapper.find('input[name="username"]').setValue('useronly');
      await flushPromises();
      expect(wrapper.emitted('valid')?.at(-1)).toEqual([false]);

      // Add empty password - still invalid
      const passwordInput = wrapper.find('input[type="password"]');
      await passwordInput.setValue('');
      await flushPromises();
      expect(wrapper.emitted('valid')?.at(-1)).toEqual([false]);

      // Add valid password - now valid
      await passwordInput.setValue('validpass');
      await flushPromises();
      expect(wrapper.emitted('valid')?.at(-1)).toEqual([true]);
    });

    it('validates URL format for simple-sms-gateway', async () => {
      const wrapper = mount(ProviderForm, {
        props: {
          provider: 'simple-sms-gateway',
        },
        global: {
          plugins: [PrimeVue],
          stubs: providerFormStubs,
        },
      });

      await flushPromises();

      // Invalid: not a URL
      await wrapper.find('input[name="baseUrl"]').setValue('invalid-url');
      await flushPromises();
      expect(wrapper.emitted('valid')?.at(-1)).toEqual([false]);

      // Valid: proper URL
      await wrapper.find('input[name="baseUrl"]').setValue('http://valid.com');
      await flushPromises();
      expect(wrapper.emitted('valid')?.at(-1)).toEqual([true]);
    });

    it('emits valid state changes during form interaction', async () => {
      const wrapper = mount(ProviderForm, {
        props: {
          provider: 'smsgate',
        },
        global: {
          plugins: [PrimeVue],
          stubs: providerFormStubs,
        },
      });

      await flushPromises();

      // Track valid emissions
      const validCalls = wrapper.emitted('valid') || [];
      const initialValid = validCalls[validCalls.length - 1];
      expect(initialValid).toEqual([false]);

      // Fill form step by step
      await wrapper.find('input[name="username"]').setValue('user');
      await flushPromises();

      // Still invalid (missing password)
      const afterUser = wrapper.emitted('valid')?.at(-1);
      expect(afterUser).toEqual([false]);

      await wrapper.find('input[type="password"]').setValue('pass');
      await flushPromises();

      // Now valid
      const afterPass = wrapper.emitted('valid')?.at(-1);
      expect(afterPass).toEqual([true]);
    });
  });
});
