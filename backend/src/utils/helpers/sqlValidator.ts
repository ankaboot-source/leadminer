const FORBIDDEN_KEYWORDS = [
  'DROP',
  'DELETE',
  'INSERT',
  'UPDATE',
  'CREATE',
  'ALTER',
  'TRUNCATE',
  'GRANT',
  'REVOKE',
  'EXECUTE',
  'CALL',
  'DO',
  'COPY',
  'VACUUM',
  'ANALYZE'
];

export function validateSelectQuery(query: string): string | null {
  if (!query || !query.trim()) {
    return 'Query is required';
  }

  const normalizedQuery = query.trim();

  if (!/^SELECT\s+/i.test(normalizedQuery)) {
    return 'Only SELECT queries are allowed';
  }

  const upperCasedQuery = normalizedQuery.toUpperCase();

  const hasForbiddenKeyword = FORBIDDEN_KEYWORDS.some((keyword) => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    return regex.test(upperCasedQuery);
  });

  if (hasForbiddenKeyword) {
    return 'Query contains forbidden keywords';
  }

  return null;
}
