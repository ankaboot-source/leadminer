/**
 * Fetches data from a Supabase table.
 * @param {Object} supabaseClient - The Supabase client to use.
 * @param {String} userId - The userId to retrieve data for.
 * @param {String} tableName - The name of the table to fetch data from.
 * @param {Number} [pageSize=1000] - The number of rows to retrieve per request.
 * @returns {Array} - An array of data from the specified table filtered by userId.
 */
export async function fetchData(
  supabaseClient,
  userId,
  tableName,
  pageSize = 1000
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
      .range(offset, parseInt(offset) + parseInt(pageSize - 1));

    if (error) {
      console.error(error);
      return [];
    }

    contacts.push(...data);
    offset = Number(pageSize);

    if (data.length === 0) {
      break;
    }
  }

  return contacts;
}
