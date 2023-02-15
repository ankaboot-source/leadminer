/**
 * Create a parametrized SQL INSERT INTO statement
 * @param {string} tableName - The name of the table to insert into
 * @param {string[]} fields - An array of field names
 * @returns {string} - The parametrized SQL INSERT INTO statement
 */
function parametrizedInsertInto(tableName, fields) {
  const fieldsCount = fields.length - 1;
  let query = `INSERT INTO ${tableName}(`;
  let values = '';

  for (let i = 0; i < fieldsCount + 1; i++) {
    query += `"${fields[i]}"${i !== fieldsCount ? ',' : ') VALUES('}`;
    values += `$${i + 1}${i !== fieldsCount ? ',' : ')'}`;
  }

  return fields.length > 0 ? query + values : '';
}

module.exports = {
  parametrizedInsertInto
};
