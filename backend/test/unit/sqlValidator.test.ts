import validateSelectQuery from '../../src/utils/helpers/sqlValidator';

describe('sqlValidator', () => {
  describe('validateSelectQuery', () => {
    it('allows valid SELECT queries', () => {
      expect(validateSelectQuery('SELECT * FROM users')).toBeNull();
      expect(
        validateSelectQuery('SELECT email, name FROM leads WHERE active = true')
      ).toBeNull();
      expect(validateSelectQuery('  SELECT   id  FROM  contacts  ')).toBeNull();
    });

    it('rejects non-SELECT queries', () => {
      expect(validateSelectQuery('DROP TABLE users')).toBe(
        'Only SELECT queries are allowed'
      );
      expect(validateSelectQuery('DELETE FROM users')).toBe(
        'Only SELECT queries are allowed'
      );
      expect(validateSelectQuery('INSERT INTO users VALUES (1)')).toBe(
        'Only SELECT queries are allowed'
      );
      expect(validateSelectQuery('UPDATE users SET name = "test"')).toBe(
        'Only SELECT queries are allowed'
      );
    });

    it('rejects queries with forbidden keywords', () => {
      expect(validateSelectQuery('SELECT * FROM users; DROP TABLE users')).toBe(
        'Query contains forbidden keywords'
      );
      expect(
        validateSelectQuery(
          'SELECT * FROM users WHERE id = 1; DELETE FROM users'
        )
      ).toBe('Query contains forbidden keywords');
    });

    it('rejects empty queries', () => {
      expect(validateSelectQuery('')).toBe('Query is required');
      expect(validateSelectQuery('   ')).toBe('Query is required');
    });
  });
});
