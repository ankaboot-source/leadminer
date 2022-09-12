const db = require("../models");

/**
 * returns a list of all the emails in the database, with the number of times they appear in each
 * field, and the last time they were used
 * @param {id} userId - the cuurent user id.
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
        db.sequelize.literal("COUNT(*) FILTER (WHERE \"conversation\" = '1')"),
        "conversation",
      ],
      [
        db.sequelize.literal("COUNT (*) FILTER ( WHERE \"from\" = 'true' )"),
        "from",
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
        "reply-to",
      ],
      [
        db.sequelize.literal("COUNT (*) FILTER ( WHERE \"to\" = 'true' )"),
        "to",
      ],

      [
        db.sequelize.literal("COUNT (*) FILTER ( WHERE \"body\" = 'true' )"),
        "body",
      ],

      [
        db.sequelize.fn(
          "SUM",
          db.sequelize.literal(
            "CASE WHEN \"bcc\" = 'true' OR \"cc\" = 'true' OR \"to\" = 'true' THEN 1 ELSE 0 END "
          )
        ),
        "recipient",
      ],
      [
        db.sequelize.fn(
          "EVERY",
          db.sequelize.literal(
            "CASE WHEN  \"from\" = 'true'  AND \"transactional\" = 'true'  THEN true ELSE false END "
          )
        ),
        "Transactional",
      ],
      [
        db.sequelize.fn(
          "EVERY",
          db.sequelize.literal(
            "CASE WHEN  \"from\" = 'true'  AND \"newsletter\" = 'true'  THEN true ELSE false END "
          )
        ),
        "Newsletter",
      ],
      [
        db.sequelize.fn(
          "SUM",
          db.sequelize.literal(
            "CASE WHEN \"from\" = 'true' OR \"reply_to\" = 'true' THEN 1 ELSE 0 END "
          )
        ),
        "sender",
      ],
      "domain_type",

      [db.sequelize.literal("MAX(date)"), "date"],
    ],
    group: ["address", "domain_type"],
  });

  return data;
}
/**
 * getCountDB returns the number of emails in the database for a given user
 * @param userId - The user's ID.
 * @returns The number of emails in the database for a given user.
 */
async function getCountDB(userId) {
  const count = await db.emailsRaw.count({
    where: { user_id: userId },
  });

  return count;
}

/**
 * Delete all the emails for a user.
 * @param userId - The user's ID.
 * @returns The number of rows deleted.
 */
async function deleteUserData(userId) {
  return db.emailsRaw.destroy({
    where: { user_id: userId },
  });
}

/**
 * Sorts the data array based on total interactions, alphabetics, and groups fields
 * @param  {Array} dataFromDatabse
 */
function sortDatabase(dataFromDatabase) {
  let counter = 0;
  const data = dataFromDatabase.map((row) => {
    if (!row.dataValues.name || row.dataValues.name == null) {
      row.dataValues.name = [""];
    } else {
      const NameArray = handleNames(
        row.dataValues.name,
        row.dataValues.address
      );

      NameArray.length == 0
        ? (row.dataValues.name = [""])
        : (row.dataValues.name = NameArray);
    }
    row.dataValues.total =
      parseInt(row.dataValues.sender) + parseInt(row.dataValues.recipient);
    row.dataValues.type = "";

    if (
      !row.dataValues.Newsletter &&
      !row.dataValues.Transactional &&
      row.dataValues.name != [""]
    ) {
      row.dataValues.type = findEmailAddressType(
        row.dataValues.address,
        row.dataValues?.name?.[0],
        row.dataValues.domain_type
      );
    }
    if (row.dataValues.Transactional) {
      counter += 1;
    }
    return row.dataValues;
  });
  return [sortDataUsingAlpha(data), counter];
}

function findEmailAddressType(emailAddress, UserName, domainType) {
  const domainAndUserName = emailAddress.split("@");
  function getScore(DomainAndUserName) {
    const splittedUserName = UserName.split(" "),
      UsernameWithoutSpace = UserName.replaceAll(/ /g, "").toLowerCase(),
      domainAndUserName = DomainAndUserName.substring(
        0,
        UsernameWithoutSpace.length
      ).toLowerCase(),
      length = domainAndUserName.length;
    let actualScore = length, // start with full points
      i = 0;

    while (i < length) {
      if (
        UsernameWithoutSpace[i] !== domainAndUserName[i] &&
        !domainAndUserName.includes(splittedUserName[0].toLowerCase()) &&
        !domainAndUserName.includes(splittedUserName?.[1]?.toLowerCase())
      ) {
        actualScore--; // subtract 1 from actual score
      }

      i++; // move to the next index
    }

    return 100 * (actualScore / length);
  }
  // array that contains two values, ex: [user,gmail.com] for the email user@gmail.com
  if (UserName.length > 0) {
    if (
      domainType == "provider" &&
      domainType != "custom" &&
      getScore(domainAndUserName[0]) > 40
    ) {
      return "Personal";
    }
    if (getScore(domainAndUserName[0]) > 40 && domainType == "custom") {
      return "Professional";
    }
  }
  return "";
}

function handleNames(name, address) {
  const NameArray = [];

  name.map((name) => {
    const Name = name
      .replaceAll('"', "")
      .replaceAll("'", "")
      .replaceAll("/", "")
      .trim();

    if (Name != address) {
      if (
        NameArray.filter((str) =>
          str.toLowerCase().includes(Name.toLowerCase())
        ).length == 0
      ) {
        NameArray.push(Name);
      }
    }
  });
  return NameArray;
}
function sortDataUsingAlpha(data) {
  const wordArr = [],
    numArr = [],
    emptyArr = [];

  data.forEach((el) => {
    if (Number(el.name[0]?.charAt(0))) {
      numArr.push(el);
    } else if (el.name && el.name.length > 0 && el.name[0] != "") {
      wordArr.push(el);
    } else {
      emptyArr.push(el);
    }
  });
  wordArr.sort((a, b) => {
    return !a.name[0] - !b.name[0] || a.name[0].localeCompare(b.name[0]);
  });
  wordArr.sort((a, b) => b.total - a.total);
  emptyArr.sort((a, b) => b.total - a.total);
  const WordThenNumArray = wordArr.concat(numArr);

  return WordThenNumArray.concat(emptyArr);
}
module.exports = { getEmails, getCountDB, deleteUserData, sortDatabase };
