/**
 * Fetches data from a Supabase table for a specific user.
 *
 * @param userId - The unique ID of the user whose data will be retrieved.
 * @param tableName - The name of the table to fetch data from.
 * @param maxRows - The maximum number of rows to retrieve per request.
 * @throws {Error}  If any of the parameters are missing or invalid.
 * @returns An array of data from the specified table filtered by userId.
 */
export async function fetchData<T>(
  userId: string,
  tableName: string,
  maxRows = 1000
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<T[]> {
  if (!userId || !tableName) {
    throw new Error('Invalid parameters');
  }

  const contacts: any = [];
  let offset = 0;
  let isFetching = true;

  while (isFetching) {
    // eslint-disable-next-line no-await-in-loop
    const { data, error } = await useSupabaseClient()
      .from(tableName)
      .select('*')
      .eq('userid', userId)
      .range(offset, offset + maxRows - 1);

    if (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      return [];
    }

    contacts.push(...data);
    offset += maxRows;

    if (data.length === 0) {
      isFetching = false;
    }
  }

  return contacts;
}
