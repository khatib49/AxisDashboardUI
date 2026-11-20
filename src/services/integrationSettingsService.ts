import api from './api';

export interface IntegrationSetting {
  id: number;
  key: string;
  value: string | null;     // masked if isSecret + isSet
  isSecret: boolean;
  isSet: boolean;
  description: string | null;
  updatedBy: string | null;
  updatedOn: string;
}

export interface IntegrationTestResult {
  ok: boolean;
  message: string | null;
}

export const integrationSettingsService = {
  list: async (): Promise<IntegrationSetting[]> => {
    const { data } = await api.get('/integration-settings');
    return data;
  },
  upsert: async (key: string, value: string | null): Promise<void> => {
    await api.put('/integration-settings', { key, value });
  },
  testAnthropic: async (): Promise<IntegrationTestResult> => {
    const { data } = await api.post('/integration-settings/test/anthropic');
    return data;
  },
  testWhatsApp: async (): Promise<IntegrationTestResult> => {
    const { data } = await api.post('/integration-settings/test/whatsapp');
    return data;
  },
  // Sends a test email to the signed-in admin through the saved Smtp.* settings.
  testEmail: async (): Promise<IntegrationTestResult> => {
    const { data } = await api.post('/integration-settings/test/email');
    return data;
  },
};
