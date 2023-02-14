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
  const result = [];
  let offset = 0;
  let response = { data: [1] };

  while (response.data.length > 0) {
    response = await supabaseClient
      .from(tableName)
      .select("*")
      .eq("userid", userId)
      .range(offset, offset + pageSize - 1);

    if (response.error) {
      console.error(response.error);
      return [];
    }

    result.push(...response.data);
    offset += pageSize;
  }

  return result;
}
