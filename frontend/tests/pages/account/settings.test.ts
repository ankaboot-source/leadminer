import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';

const COMPONENT_PATH =
  '/home/badreddine/Projects/leadminer/.worktrees/sms-campaigns/.worktrees/fleet-mode/frontend/src/pages/account/settings.vue';

describe('Settings Structure Tests', () => {
  let componentContent: string;

  beforeEach(() => {
    componentContent = readFileSync(COMPONENT_PATH, 'utf-8');
  });

  it('should have only one SMS panel with SMS Gateways header', () => {
    // Count occurrences of SMS-related panel headers
    const smsGatewaySettingsMatches = componentContent.match(
      /:header="t\('sms_gateway_settings'\)"/g,
    );
    const smsGatewaysMatches = componentContent.match(
      /:header="t\('sms_gateways'\)"/g,
    );

    // Should have exactly one SMS panel
    const totalSmsPanels =
      (smsGatewaySettingsMatches?.length || 0) +
      (smsGatewaysMatches?.length || 0);
    expect(totalSmsPanels).toBe(1);

    // Should use new header
    expect(componentContent).toContain(':header="t(\'sms_gateways\')"');
  });

  it('should NOT have SMSGate-specific form fields', () => {
    // Old SMSGate configuration fields should be removed
    expect(componentContent).not.toContain('smsgateBaseUrlInput');
    expect(componentContent).not.toContain('smsgateUsernameInput');
    expect(componentContent).not.toContain('smsgatePasswordInput');
    expect(componentContent).not.toContain('saveSmsGatewaySettings');
  });

  it('should NOT have simple-sms-gateway-specific form fields', () => {
    // Old simple-sms-gateway configuration fields should be removed
    expect(componentContent).not.toContain('simpleSmsGatewayBaseUrlInput');
    expect(componentContent).not.toContain('saveSimpleSmsGatewaySettings');
  });

  it('should contain SmsFleetManagement component', () => {
    expect(componentContent).toContain('SmsFleetManagement');
    expect(componentContent).toContain(
      "import SmsFleetManagement from '~/components/sms-fleet/SmsFleetManagement.vue'",
    );
  });

  it('should NOT have SMS gateway status checks', () => {
    // The old twilioAvailable status check should be removed
    expect(componentContent).not.toContain('fetchSmsProviderStatus');
    expect(componentContent).not.toContain('twilioAvailable');
  });

  it('should NOT have SMS-related i18n keys for old configuration', () => {
    // Old i18n keys should be removed
    expect(componentContent).not.toContain('"sms_gateway_settings"');
    expect(componentContent).not.toContain('"sms_gateway_description"');
    expect(componentContent).not.toContain('"smsgate_base_url"');
    expect(componentContent).not.toContain('"smsgate_username"');
    expect(componentContent).not.toContain('"smsgate_password"');
    expect(componentContent).not.toContain('"save_sms_gateway"');
    expect(componentContent).not.toContain('"simple_sms_gateway_settings"');
    expect(componentContent).not.toContain('"simple_sms_gateway_base_url"');
    expect(componentContent).not.toContain('"save_simple_sms_gateway"');
  });

  it('should have new SMS Gateways i18n key', () => {
    expect(componentContent).toContain('"sms_gateways"');
  });

  it('should preserve other settings panels', () => {
    // Profile, Delete Account, and Legal panels should still exist
    expect(componentContent).toContain(':header="t(\'profile_information\')"');
    expect(componentContent).toContain(':header="t(\'delete_account\')"');
    expect(componentContent).toContain(
      ':header="$t(\'auth.legal_information\')"',
    );
    expect(componentContent).toContain('LegalInformation');
  });
});
