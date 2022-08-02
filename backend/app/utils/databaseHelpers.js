const db = require("../models");

/**
 * It returns a list of all the emails in the database, with the number of times they appear in each
 * field, and the last time they were used
 * @returns An array of objects with the following properties:
 * address, name, transactional, newsletter, conversation, from, to, cc, bcc, reply_to, body, date
 */
async function getEmails(userId) {
  const data = await db.emailsRaw.findAll({
    where: { user_id: userId },
    attributes: [
      "address",
      [
        db.sequelize.literal(
          "json_agg(DISTINCT name) FILTER ( WHERE \"name\" = '' IS FALSE)"
        ),
        "name",
      ],

      [
        db.sequelize.literal(
          "COUNT(*) FILTER ( WHERE \"transactional\" = 'true' )"
        ),
        "transactional",
      ],
      [
        db.sequelize.literal(
          "COUNT(*) FILTER ( WHERE \"newsletter\" = 'true' )"
        ),
        "newsletter",
      ],
      [
        db.sequelize.literal("COUNT(*) FILTER (WHERE \"conversation\" = '1')"),
        "conversation",
      ],
      [
        db.sequelize.literal("COUNT (*) FILTER ( WHERE \"from\" = 'true' )"),
        "from",
      ],

      [
        db.sequelize.literal("COUNT (*) FILTER ( WHERE \"to\" = 'true' )"),
        "to",
      ],
      [
        db.sequelize.literal("COUNT (*) FILTER ( WHERE \"cc\" = 'true' )"),
        "cc",
      ],
      [
        db.sequelize.literal("COUNT (*) FILTER ( WHERE \"bcc\" = 'true' )"),
        "bcc",
      ],
      [
        db.sequelize.literal(
          "COUNT (*) FILTER ( WHERE \"reply_to\" = 'true' )"
        ),
        "reply_to",
      ],
      [
        db.sequelize.literal("COUNT (*) FILTER ( WHERE \"body\" = 'true' )"),
        "body",
      ],
      [
        db.sequelize.literal("COUNT (*) FILTER ( WHERE \"body\" = 'true' )"),
        "body",
      ],
      [db.sequelize.literal("MAX(date)"), "date"],
    ],
    group: ["address"],
  });

  return data;
}
async function getCountDB(userId) {
  const count = await db.emailsRaw.count({
    where: { user_id: userId },
  });
  return count;
}

async function deleteUserData(userId) {
  return await db.emailsRaw.destroy({
    where: { user_id: userId },
  });
}

module.exports = { getEmails, getCountDB, deleteUserData };
