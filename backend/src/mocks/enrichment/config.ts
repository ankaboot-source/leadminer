export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m'
};

export function coloredLog(color: string, text: string) {
  return `${color}${text}${colors.reset}`;
}

export const SERVER_PORT = 8083;
export const VOILANORBERT_USERNAME = 'any_string';
export const VOILANORBERT_API_TOKEN = 'test-api-key';
export const PROXYCURL_API_TOKEN = 'test-api-key';
