import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { createPinia, setActivePinia } from 'pinia';

const COMPONENT_PATH =
  '/home/badreddine/Projects/leadminer/.worktrees/sms-fleet-mode/frontend/src/components/campaigns/SmsCampaignComposerDialog.vue';

describe('SmsCampaignComposerDialog Structure Tests', () => {
  let componentContent: string;

  beforeEach(() => {
    setActivePinia(createPinia());
    componentContent = readFileSync(COMPONENT_PATH, 'utf-8');
  });

  it('should NOT have fleet mode toggle (InputSwitch)', () => {
    expect(componentContent).not.toContain('InputSwitch');
    expect(componentContent).not.toContain('v-model="form.fleetMode"');
    expect(componentContent).not.toContain('input-id="fleetMode"');
    expect(componentContent).not.toContain("t('fleet_mode'");
    expect(componentContent).not.toContain("t('fleet_mode_help'");
    expect(componentContent).not.toContain("t('fleet_mode_description'");
  });

  it('should always show FleetGatewaySelector (no v-if)', () => {
    expect(componentContent).toContain('FleetGatewaySelector');
    expect(componentContent).not.toContain('v-if="form.fleetMode"');
  });

  it('should NOT have Configure Gateways button', () => {
    expect(componentContent).not.toContain("'configure_gateways'");
    expect(componentContent).not.toContain('showFleetConfigDialog');
    expect(componentContent).not.toContain('SmsFleetManagement');
  });

  it('should NOT have showFleetConfigDialog state', () => {
    expect(componentContent).not.toContain('showFleetConfigDialog');
    expect(componentContent).not.toContain('const showFleetConfigDialog = ref');
  });

  it('should emit add-gateway event from FleetGatewaySelector', () => {
    expect(componentContent).toContain('@add-gateway');
    expect(componentContent).toContain("$emit('add-gateway')");
  });

  it('should NOT have single provider mode (smsgate, twilio, simple-sms-gateway)', () => {
    expect(componentContent).not.toContain('form.provider');
    expect(componentContent).not.toContain('SelectButton');
    expect(componentContent).not.toContain('providerOptions');
    expect(componentContent).not.toContain('smsgateBaseUrl');
    expect(componentContent).not.toContain('smsgateUsername');
    expect(componentContent).not.toContain('smsgatePassword');
    expect(componentContent).not.toContain('simpleSmsGatewayBaseUrl');
    expect(componentContent).not.toContain('twilioAvailable');
  });

  it('should submit with fleetMode=true and selectedGatewayIds', () => {
    expect(componentContent).toContain('fleetMode: true');
    expect(componentContent).toContain(
      'selectedGatewayIds: form.selectedGatewayIds',
    );
  });

  it('should NOT have fleetMode in form state', () => {
    const formReactiveMatch = componentContent.match(
      /const form = reactive\(\{[\s\S]*?\}\)/,
    );
    if (formReactiveMatch) {
      const formObject = formReactiveMatch[0];
      expect(formObject).not.toContain('fleetMode:');
    }
  });

  it('should have updated monthly recipient limit max to 200', () => {
    expect(componentContent).toContain(':max="200"');
    expect(componentContent).not.toContain(':max="250"');
  });
});

describe('SmsCampaignComposerDialog i18n', () => {
  let componentContent: string;

  beforeEach(() => {
    componentContent = readFileSync(COMPONENT_PATH, 'utf-8');
  });

  it('should have updated sms_limit_note with fleet mode explanation', () => {
    expect(componentContent).toContain('"sms_limit_note"');
    expect(componentContent).toContain('200 SMS/day and 200 recipients/month');
  });

  it('should NOT have configure_gateways translation key', () => {
    expect(componentContent).not.toContain('"configure_gateways"');
  });

  it('should have sms_gateways translation key', () => {
    expect(componentContent).toContain('"sms_gateways"');
  });

  it('should NOT have removed provider translation keys', () => {
    expect(componentContent).not.toContain('"smsgate_base_url"');
    expect(componentContent).not.toContain('"smsgate_username"');
    expect(componentContent).not.toContain('"smsgate_password"');
    expect(componentContent).not.toContain('"twilio_not_configured"');
    expect(componentContent).not.toContain('"simple_sms_gateway_base_url"');
    expect(componentContent).not.toContain('"provider_default_note"');
    expect(componentContent).not.toContain('"setup_help"');
  });
});
