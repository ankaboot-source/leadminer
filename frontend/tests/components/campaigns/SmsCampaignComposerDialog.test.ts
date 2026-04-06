import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { createPinia, setActivePinia } from 'pinia';

const COMPONENT_PATH =
  '/home/badreddine/Projects/leadminer/.worktrees/sms-campaigns/.worktrees/fleet-mode/frontend/src/components/campaigns/SmsCampaignComposerDialog.vue';

describe('SmsCampaignComposerDialog Structure Tests', () => {
  let componentContent: string;

  beforeEach(() => {
    setActivePinia(createPinia());
    componentContent = readFileSync(COMPONENT_PATH, 'utf-8');
  });

  it('should NOT have fleet mode toggle (InputSwitch)', () => {
    // Verify the fleet mode toggle has been completely removed
    expect(componentContent).not.toContain('InputSwitch');
    expect(componentContent).not.toContain('v-model="form.fleetMode"');
    expect(componentContent).not.toContain('input-id="fleetMode"');
    expect(componentContent).not.toContain("t('fleet_mode'");
    expect(componentContent).not.toContain("t('fleet_mode_help'");
    expect(componentContent).not.toContain("t('fleet_mode_description'");
  });

  it('should always show FleetGatewaySelector (no v-if)', () => {
    // FleetGatewaySelector should be present without conditional rendering
    expect(componentContent).toContain('FleetGatewaySelector');
    // Should NOT have v-if="form.fleetMode" making it conditional
    expect(componentContent).not.toContain('v-if="form.fleetMode"');
  });

  it('should have Configure Gateways button', () => {
    expect(componentContent).toContain("'configure_gateways'");
    expect(componentContent).toContain('showFleetConfigDialog = true');
  });

  it('should have SmsFleetManagement in dialog', () => {
    expect(componentContent).toContain('SmsFleetManagement');
    expect(componentContent).toContain('showFleetConfigDialog');
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

  it('should have showFleetConfigDialog state', () => {
    expect(componentContent).toContain('showFleetConfigDialog');
    expect(componentContent).toContain('const showFleetConfigDialog = ref');
  });

  it('should open fleet config dialog on button click', () => {
    expect(componentContent).toContain('@click="showFleetConfigDialog = true"');
  });

  it('should NOT have fleetMode in form state', () => {
    // The form reactive object should NOT have fleetMode property
    const formReactiveMatch = componentContent.match(
      /const form = reactive\(\{[\s\S]*?\}\)/,
    );
    if (formReactiveMatch) {
      const formObject = formReactiveMatch[0];
      expect(formObject).not.toContain('fleetMode:');
    }
  });
});

describe('SmsCampaignComposerDialog i18n', () => {
  let componentContent: string;

  beforeEach(() => {
    componentContent = readFileSync(COMPONENT_PATH, 'utf-8');
  });

  it('should have new translation keys for fleet mode', () => {
    expect(componentContent).toContain('"sms_gateways"');
    expect(componentContent).toContain('"configure_gateways"');
  });

  it('should NOT have removed provider translation keys', () => {
    // All provider-related translations should be removed
    expect(componentContent).not.toContain('"smsgate_base_url"');
    expect(componentContent).not.toContain('"smsgate_username"');
    expect(componentContent).not.toContain('"smsgate_password"');
    expect(componentContent).not.toContain('"twilio_not_configured"');
    expect(componentContent).not.toContain('"simple_sms_gateway_base_url"');
    expect(componentContent).not.toContain('"provider_default_note"');
    expect(componentContent).not.toContain('"setup_help"');
  });
});
