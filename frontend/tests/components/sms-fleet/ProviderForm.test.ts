import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import ProviderForm from '~/components/sms-fleet/ProviderForm.vue';

const app = createApp({});
app.use(PrimeVue);

describe('ProviderForm', () => {
  it('renders provider configuration fields', () => {
    const wrapper = mount(ProviderForm, {
      props: {
        provider: 'smsgate',
      },
      global: {
        plugins: [PrimeVue],
        stubs: {
          InputText: {
            template:
              '<input :name="$attrs.name" :type="$attrs.type" :placeholder="$attrs.placeholder" />',
          },
          Button: {
            template:
              '<button type="submit" :disabled="$attrs.disabled">{{ label }}</button>',
            props: ['label', 'icon', 'disabled'],
          },
        },
      },
    });
    expect(wrapper.find('input[name="baseUrl"]').exists()).toBe(true);
    expect(wrapper.find('input[name="apiKey"]').exists()).toBe(true);
  });

  it('emits "valid" event when form is valid', async () => {
    const wrapper = mount(ProviderForm, {
      props: {
        provider: 'smsgate',
      },
      global: {
        plugins: [PrimeVue],
        stubs: {
          InputText: {
            template:
              '<input :name="$attrs.name" :type="$attrs.type" :placeholder="$attrs.placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" />',
          },
          Button: {
            template:
              '<button type="submit" :disabled="$attrs.disabled">{{ label }}</button>',
            props: ['label', 'icon', 'disabled'],
          },
        },
      },
    });
    await wrapper
      .find('input[name="baseUrl"]')
      .setValue('https://api.smsgate.com');
    await wrapper.find('input[name="apiKey"]').setValue('test-api-key');
    expect(wrapper.emitted('valid')?.at(-1)).toEqual([true]);
  });

  it('emits "submit" event with gateway data when form submitted', async () => {
    const wrapper = mount(ProviderForm, {
      props: {
        provider: 'smsgate',
      },
      global: {
        plugins: [PrimeVue],
        stubs: {
          InputText: {
            template:
              '<input :name="$attrs.name" :type="$attrs.type" :placeholder="$attrs.placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" />',
          },
          Button: {
            template:
              '<button type="submit" :disabled="$attrs.disabled">{{ label }}</button>',
            props: ['label', 'icon', 'disabled'],
          },
        },
      },
    });
    await wrapper
      .find('input[name="baseUrl"]')
      .setValue('https://api.smsgate.com');
    await wrapper.find('input[name="apiKey"]').setValue('test-api-key');
    await wrapper.find('form').trigger('submit');
    expect(wrapper.emitted('submit')).toBeTruthy();
    expect(wrapper.emitted('submit')![0][0]).toEqual({
      provider: 'smsgate',
      baseUrl: 'https://api.smsgate.com',
      apiKey: 'test-api-key',
    });
  });
});
