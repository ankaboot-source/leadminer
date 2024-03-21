import { describe, expect, test } from 'vitest';
import { check } from 'recheck';
import { PASSWORD_PATTERN } from '@/utils/password'; // Assuming you export your regex from a file

async function testRegexSafety(regexSource: string, regexFlags: string) {
  const diagnostics = await check(regexSource, regexFlags);

  if (diagnostics.status === 'vulnerable') {
    const vulParts = diagnostics.hotspot.map(
      (i) =>
        ` index(${i.start}, ${i.end}): ${regexSource.slice(i.start, i.end)}`
    );

    const messageError = `
      Regex is vulnerable! 
      - Complexity: ${diagnostics.complexity.type} 
      - Attack string: ${diagnostics.attack.pattern} 
      - Vulnerable parts: ${vulParts}
    `;
    // eslint-disable-next-line no-console
    console.error(messageError);
  }

  expect(diagnostics.status).toBe('safe');
}

describe('Regex redos checker', () => {
  const regex = [PASSWORD_PATTERN];

  test.concurrent.each(regex)('Regex should be REDOS safe: %s', async (re) => {
    await testRegexSafety(re.source, re.flags);
  });
});
