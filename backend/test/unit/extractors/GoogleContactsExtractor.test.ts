import { ContactFrontend } from '../../../src/db/types';
import {
  GoogleContactsExtractor,
  GoogleContactsFormat
} from '../../../src/services/extractors/engines/GoogleContactsExtractor';

describe('GoogleContactsExtractor', () => {
  it('returns correctly mapped contacts for a single contact', async () => {
    const data: GoogleContactsFormat = {
      source: 'google-contacts:joe@gmail.com',
      contacts: [
        {
          person: {
            id: '1',
            user_id: 'user1',
            email: 'test@example.com',
            name: 'Test User'
          } as ContactFrontend,
          tags: ['contact']
        }
      ]
    };
    const extractor = new GoogleContactsExtractor(data);
    const result = await extractor.getContacts();

    expect((result as any).persons).toEqual(data.contacts);
    expect((result as any).organizations).toEqual([]);
    expect(result.type).toBe('google-contacts');
  });

  it('handles empty state (no contacts)', async () => {
    const data: GoogleContactsFormat = {
      source: 'google-contacts:empty@gmail.com',
      contacts: []
    };
    const extractor = new GoogleContactsExtractor(data);
    const result = await extractor.getContacts();

    expect((result as any).persons).toEqual([]);
    expect((result as any).organizations).toEqual([]);
    expect(result.type).toBe('google-contacts');
  });

  it('handles multiple contacts correctly', async () => {
    const data: GoogleContactsFormat = {
      source: 'google-contacts:multiple@gmail.com',
      contacts: [
        {
          person: {
            id: '1',
            user_id: 'user1',
            email: 'one@example.com',
            name: 'User One'
          } as ContactFrontend,
          tags: ['contact']
        },
        {
          person: {
            id: '2',
            user_id: 'user1',
            email: 'two@example.com',
            name: 'User Two'
          } as ContactFrontend,
          tags: ['contact', 'vip']
        }
      ]
    };
    const extractor = new GoogleContactsExtractor(data);
    const result = await extractor.getContacts();

    expect((result as any).persons).toEqual(data.contacts);
    expect((result as any).persons).toHaveLength(2);
    expect((result as any).organizations).toEqual([]);
    expect(result.type).toBe('google-contacts');
  });
});
