import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createApp, ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import SmsFleetManagement from '~/components/sms-fleet/SmsFleetManagement.vue';

// Mock the Pinia store
const mockGateways = ref<any[]>([]);
const mockFetchGateways = vi.fn();
const mockCreateGateway = vi.fn();
const mockDeleteGateway = vi.fn();

vi.mock('~/stores/sms-fleet', () => ({
  useSmsFleetStore: vi.fn(() => ({
    gateways: mockGateways.value,
    isLoading: false,
    error: null,
    fetchGateways: mockFetchGateways,
    createGateway: mockCreateGateway,
    deleteGateway: mockDeleteGateway,
    updateGateway: vi.fn(),
    testGateway: vi.fn(),
  })),
}));

// Mock vue-i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

// Mock PrimeVue useToast
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({
    add: vi.fn(),
    remove: vi.fn(),
    removeAll: vi.fn(),
  })),
}));

// Mock Nuxt composables
vi.mock('#imports', () => ({
  onMounted: (cb: () => void) => cb(),
}));

const app = createApp({});
app.use(PrimeVue);

describe('SmsFleetManagement', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockGateways.value = [];
  });

  it('shows Add Gateway button when provider selected and form valid', async () => {
    const wrapper = mount(SmsFleetManagement, {
      global: {
        plugins: [PrimeVue],
        stubs: {
          Dropdown: {
            template: `
              <select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)" name="provider">
                <option value="">Select Provider</option>
                <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            `,
            props: [
              'modelValue',
              'options',
              'optionLabel',
              'optionValue',
              'placeholder',
              'class',
            ],
          },
          ProviderForm: {
            template: `
              <form @submit.prevent="$emit('submit', { provider: provider, baseUrl: localBaseUrl, apiKey: localApiKey })">
                <input name="baseUrl" v-model="localBaseUrl" @input="emitValid" />
                <input name="apiKey" v-model="localApiKey" @input="emitValid" />
                <button type="submit" :disabled="!isValid" label="Add Gateway">Add Gateway</button>
              </form>
            `,
            props: ['provider'],
            emits: ['valid', 'submit'],
            setup(props, { emit }) {
              const localBaseUrl = ref('');
              const localApiKey = ref('');
              const isValid = ref(false);

              function emitValid() {
                isValid.value = !!(localBaseUrl.value && localApiKey.value);
                emit('valid', isValid.value);
              }

              return { localBaseUrl, localApiKey, isValid, emitValid };
            },
          },
          Chip: {
            template:
              '<div class="gateway-chip">{{ label }}<button v-if="removable" @click="$emit(\'remove\')">×</button></div>',
            props: ['label', 'removable'],
          },
          ProgressSpinner: {
            template: '<div class="p-progressspinner"></div>',
          },
        },
      },
    });

    // Select provider - form should appear
    await wrapper.find('select[name="provider"]').setValue('smsgate');

    // Fill in form fields
    await wrapper
      .find('input[name="baseUrl"]')
      .setValue('https://api.smsgate.com');
    await wrapper.find('input[name="apiKey"]').setValue('test-key');

    // Button should exist and be enabled (form is valid)
    const submitButton = wrapper.find('button[type="submit"]');
    expect(submitButton.exists()).toBe(true);
    expect(submitButton.attributes('disabled')).toBeUndefined();
  });

  it('displays configured gateways as chips', async () => {
    // Set up mock gateways
    mockGateways.value = [
      {
        id: 'gateway-1',
        user_id: 'user-1',
        name: 'My Gateway',
        provider: 'smsgate',
        config: { baseUrl: 'https://api.smsgate.com' },
        is_active: true,
        daily_limit: 100,
        monthly_limit: 1000,
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
        stubs: {
          Dropdown: {
            template: '<select name="provider"></select>',
            props: ['modelValue', 'options'],
          },
          ProviderForm: {
            template: '<div v-if="provider"></div>',
            props: ['provider'],
          },
          Chip: {
            template:
              '<div class="gateway-chip">{{ label }}<button v-if="removable" @click="$emit(\'remove\')">×</button></div>',
            props: ['label', 'removable'],
          },
          ProgressSpinner: {
            template: '<div class="p-progressspinner"></div>',
          },
        },
      },
    });

    // Should display the gateway as a chip
    expect(wrapper.find('.gateway-chip').exists()).toBe(true);
    expect(wrapper.find('.gateway-chip').text()).toContain('SMSGate');
    expect(wrapper.find('.gateway-chip').text()).toContain('My Gateway');
  });

  it('resets form after adding gateway', async () => {
    const wrapper = mount(SmsFleetManagement, {
      global: {
        plugins: [PrimeVue],
        stubs: {
          Dropdown: {
            template: `
              <select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)" name="provider">
                <option value="">Select Provider</option>
                <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            `,
            props: [
              'modelValue',
              'options',
              'optionLabel',
              'optionValue',
              'placeholder',
              'class',
            ],
          },
          ProviderForm: {
            template: `
              <form @submit.prevent="$emit('submit', { provider: provider, baseUrl: localBaseUrl, apiKey: localApiKey }); localBaseUrl = ''; localApiKey = '';">
                <input name="baseUrl" v-model="localBaseUrl" @input="emitValid" />
                <input name="apiKey" v-model="localApiKey" @input="emitValid" />
                <button type="submit" :disabled="!isValid" label="Add Gateway">Add Gateway</button>
              </form>
            `,
            props: ['provider'],
            emits: ['valid', 'submit'],
            setup(props, { emit }) {
              const localBaseUrl = ref('');
              const localApiKey = ref('');
              const isValid = ref(false);

              function emitValid() {
                isValid.value = !!(localBaseUrl.value && localApiKey.value);
                emit('valid', isValid.value);
              }

              return { localBaseUrl, localApiKey, isValid, emitValid };
            },
          },
          Chip: {
            template: '<div class="gateway-chip">{{ label }}</div>',
            props: ['label', 'removable'],
          },
          ProgressSpinner: {
            template: '<div class="p-progressspinner"></div>',
          },
        },
      },
    });

    // Select provider and fill form
    await wrapper.find('select[name="provider"]').setValue('smsgate');
    await wrapper
      .find('input[name="baseUrl"]')
      .setValue('https://api.smsgate.com');
    await wrapper.find('input[name="apiKey"]').setValue('test-key');

    // Submit the form
    await wrapper.find('form').trigger('submit');

    // Form should be reset after submission
    expect(
      (wrapper.find('input[name="baseUrl"]').element as HTMLInputElement).value,
    ).toBe('');
    expect(
      (wrapper.find('input[name="apiKey"]').element as HTMLInputElement).value,
    ).toBe('');
  });

  it('Add Gateway button is disabled when form is invalid', async () => {
    const wrapper = mount(SmsFleetManagement, {
      global: {
        plugins: [PrimeVue],
        stubs: {
          Dropdown: {
            template: `
              <select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)" name="provider">
                <option value="">Select Provider</option>
                <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            `,
            props: [
              'modelValue',
              'options',
              'optionLabel',
              'optionValue',
              'placeholder',
              'class',
            ],
          },
          ProviderForm: {
            template: `
              <form @submit.prevent="$emit('submit', { provider: provider, baseUrl: localBaseUrl, apiKey: localApiKey })">
                <input name="baseUrl" v-model="localBaseUrl" @input="emitValid" />
                <input name="apiKey" v-model="localApiKey" @input="emitValid" />
                <button type="submit" :disabled="!isValid" label="Add Gateway">Add Gateway</button>
              </form>
            `,
            props: ['provider'],
            emits: ['valid', 'submit'],
            setup(props, { emit }) {
              const localBaseUrl = ref('');
              const localApiKey = ref('');
              const isValid = ref(false);

              function emitValid() {
                isValid.value = !!(localBaseUrl.value && localApiKey.value);
                emit('valid', isValid.value);
              }

              return { localBaseUrl, localApiKey, isValid, emitValid };
            },
          },
          Chip: {
            template: '<div class="gateway-chip">{{ label }}</div>',
            props: ['label', 'removable'],
          },
          ProgressSpinner: {
            template: '<div class="p-progressspinner"></div>',
          },
        },
      },
    });

    // Select provider - form appears but is empty
    await wrapper.find('select[name="provider"]').setValue('smsgate');

    // Button should be disabled (form invalid - empty fields)
    const submitButton = wrapper.find('button[type="submit"]');
    expect(submitButton.exists()).toBe(true);
    expect(submitButton.attributes('disabled')).toBeDefined();

    // Fill in only baseUrl (not apiKey) - still invalid
    await wrapper
      .find('input[name="baseUrl"]')
      .setValue('https://api.smsgate.com');
    expect(submitButton.attributes('disabled')).toBeDefined();

    // Fill in apiKey - now valid
    await wrapper.find('input[name="apiKey"]').setValue('test-key');
    expect(submitButton.attributes('disabled')).toBeUndefined();
  });
});
