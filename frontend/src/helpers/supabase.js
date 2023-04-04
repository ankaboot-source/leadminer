/**
 * Fetches data from a Supabase table for a specific user.
 * 
 * @param {import('@supabase/supabase-js').createClient} supabaseClient - The Supabase client to use for fetching data.
 * @param {string} userId - The unique ID of the user whose data will be retrieved.
 * @param {string} tableName - The name of the table to fetch data from.
 * @param {number} [maxRows=1000] - The maximum number of rows to retrieve per request.
 * @throws {Error} - If any of the parameters are missing or invalid.
 * @returns {Array} - An array of data from the specified table filtered by userId.
 */
export async function fetchData(
  supabaseClient,
  userId,
  tableName,
  maxRows = 1000
) {
  if (!supabaseClient || !userId || !tableName) {
    throw new Error("Invalid parameters");
  }

  const contacts = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabaseClient
      .from(tableName)
      .select("*")
      .eq("userid", userId)
      .range(offset, offset + maxRows - 1);

    if (error) {
      console.error(error);
      return [];
    }

    contacts.push(...data);
    offset += maxRows;

    if (data.length === 0) {
      break;
    }
  }

  return contacts;
}
