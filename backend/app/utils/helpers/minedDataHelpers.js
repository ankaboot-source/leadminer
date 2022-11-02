const db = require('../../models');

/**
 * returns a list of all the emails in the database, with the number of times they appear in each
 * field, and the last time they were used, aggregates some fields and more
 * @param {id} userId - the cuurent user id.
 * @returns An array of objects with the following properties:
 * address, name, transactional, newsletter, conversation, from, to, cc, bcc, reply_to, body, date...
 */
async function getEmails(userId) {
  const data = await db.emailsRaw.findAll({
    where: { user_id: userId },
    attributes: [
      'address',
      [
        db.sequelize.literal(
          'json_agg(DISTINCT name) FILTER ( WHERE "name" = \'\' IS FALSE)'
        ),
        'name'
      ],

      [
        db.sequelize.literal('COUNT (*) FILTER ( WHERE "from" = \'true\' )'),
        'from'
      ],
      [
        db.sequelize.literal('COUNT (*) FILTER ( WHERE "cc" = \'true\' )'),
        'cc'
      ],
      [
        db.sequelize.literal('COUNT (*) FILTER ( WHERE "bcc" = \'true\' )'),
        'bcc'
      ],
      [
        db.sequelize.literal(
          'COUNT (*) FILTER ( WHERE "reply_to" = \'true\' )'
        ),
        'reply-to'
      ],
      [
        db.sequelize.literal('COUNT (*) FILTER ( WHERE "to" = \'true\' )'),
        'to'
      ],
      [
        db.sequelize.literal('COUNT(*) FILTER (WHERE "conversation" = \'1\')'),
        'conversation'
      ],

      [
        db.sequelize.literal('COUNT (*) FILTER ( WHERE "body" = \'true\' )'),
        'body'
      ],

      [
        db.sequelize.fn(
          'SUM',
          db.sequelize.literal(
            'CASE WHEN "from" = \'true\' OR "reply_to" = \'true\' THEN 1 ELSE 0 END '
          )
        ),
        'sender'
      ],

      [
        db.sequelize.fn(
          'SUM',
          db.sequelize.literal(
            'CASE WHEN "bcc" = \'true\' OR "cc" = \'true\' OR "to" = \'true\' THEN 1 ELSE 0 END '
          )
        ),
        'recipient'
      ],

      [
        db.sequelize.fn(
          'EVERY',
          db.sequelize.literal(
            'CASE WHEN  "from" = \'true\'  AND "transactional" = \'true\'  THEN true ELSE false END '
          )
        ),
        'Transactional'
      ],
      [
        db.sequelize.fn(
          'EVERY',
          db.sequelize.literal(
            'CASE WHEN  "from" = \'true\'  AND "newsletter" = \'true\'  THEN true ELSE false END '
          )
        ),
        'Newsletter'
      ],

      'domain_type',
      'noReply',

      [db.sequelize.literal('MAX(date)'), 'date']
    ],
    group: ['address', 'domain_type', 'noReply']
  });

  return data;
}
/**
 * getCountDB returns the number of emails in the database for a given user
 * used in counting mined emails
 * @param userId - The user's ID.
 * @returns The number of emails in the database for a given user.
 */
async function getCountDB(userId) {
  const count = await db.emailsRaw.count({
    where: { user_id: userId }
  });

  return count;
}

/**
 * "Get the number of emails that have been marked as no reply."
 *
 * The function is async because it uses the await keyword. The await keyword is used to wait for a
 * promise to resolve, here it counts that returns the number of emails addresses marked as noreply email
 * @param userId - The user's ID
 * @returns The number of emails that have been marked as noReply
 */
async function getNoReplyEmails(userId) {
  const count = await db.emailsRaw.count({
    where: { user_id: userId, noReply: true },
    distinct: true,
    col: 'address'
  });
  return count;
}

/**
 * Delete all the emails for a user.
 * @param userId - The user's ID.
 * @returns The number of rows deleted.
 */
function deleteUserData(userId) {
  return db.emailsRaw.destroy({
    where: { user_id: userId }
  });
}

/**
 * getScore takes the domain and username and return a "matching score" between
 * username and email address username part
 * @example leadminer@leadminer.io VS leadminer
 * @param {string} DomainAndUserName - The email address of the user.
 * @param {string} UserName - The name of the user
 * @returns the percentage of the match between the username and the email address.
 */
function getScore(DomainAndUserName, UserName) {
  //split is to check each part of the name apart
  //e.g: address: lead-miner@lead.com |||| Name: miner app
  //then we can match the name with the address
  const splittedUserName = UserName.split(' '),
    UsernameWithoutSpace = UserName.replaceAll(/ /g, '').toLowerCase(), // try to get name with spaces
    domainAndUserName = DomainAndUserName.substring(
      0,
      UsernameWithoutSpace.length
    ).toLowerCase(), //get the same length so we can compare the part before "@" vs the current name
    length = domainAndUserName.length;
  let actualScore = length, // start with full points(100% match)
    i = 0;

  while (i < length) {
    if (
      UsernameWithoutSpace[`${i}`] !== domainAndUserName[`${i}`] &&
      !domainAndUserName.includes(splittedUserName[0].toLowerCase()) &&
      !domainAndUserName.includes(splittedUserName?.[1]?.toLowerCase())
    ) {
      actualScore--; // subtract 1 from actual score
    }
    i++; // move to the next index
  }
  return 100 * (actualScore / length);
}
/**
 * findEmailAddressType takes an email address, a list of user names, and a domain type, and returns the type of email
 * address, based on the domain type and the matching score of the name before or after the "@"
 * @param {String} emailAddress - The email address you want to check
 * @param {Array} userNames - An array of user names that you want to check against.
 * @param {String} domainType - This is the type of domain, it can be either "provider" or "custom"
 * @returns the type of email address.
 */
function findEmailAddressType(emailAddress, userNames, domainType) {
  // array that contains two values, ex: [user,gmail.com] for the email user@gmail.com
  const domainAndUserName = emailAddress.split('@')[0];

  if (!userNames || getScore(domainAndUserName[0], userNames[0]) <= 40) {
    return '';
  }

  switch (domainType) {
    case 'custom':
      return 'Professional';
    case 'provider':
      return 'Personal';
    default:
      return '';
  }
}

/**
 * handleNames takes in an array of names and an email address,
 * and returns an array of names that are more readable and don't includes the address itself
 * @param {String} name - This is the name of the business.
 * @param {String} emailAddress - The address of the property
 * @returns An array of names that have been cleaned up.
 */
function handleNames(names, emailAddress) {
  const namesArray = [];
  for (const name of names) {
    // remove all bad chars
    const Name = name
      .replaceAll('"', '')
      .replaceAll("'", '')
      .replaceAll('/', '')
      .trim();
    // case when the name is not the same as the address
    if (Name !== emailAddress) {
      if (
        namesArray.filter((str) =>
          str.toLowerCase().includes(Name.toLowerCase())
        ).length === 0
      ) {
        // if OK then push to the array
        namesArray.push(Name);
      }
    }
  }

  return namesArray;
}
/**
 * sortDataUsingAlpha sorts the data base on the name letters
 * first are alpha, then names with numbers, finally empty names
 * @param data - an array of objects
 * @returns an array of objects sorted by the total property in descending order.
 */
function sortDataUsingAlpha(data) {
  const wordArr = [],
    numArr = [],
    emptyArr = [];

  data.forEach((el) => {
    // name begins with number eg: name = 4four
    if (Number(el.name[0]?.charAt(0))) {
      numArr.push(el);
    } else if (el.name && el.name.length > 0 && el.name[0] !== '') {
      // name begins with alpha or char
      wordArr.push(el);
    } else {
      // no name at all
      emptyArr.push(el);
    }
  });
  // sort the names desc: from A => Z
  wordArr.sort((a, b) => {
    return !a.name[0] - !b.name[0] || a.name[0].localeCompare(b.name[0]);
  });
  // sort with total :desc
  wordArr.sort((a, b) => b.total - a.total);
  // sort emails that have no names based on total :desc
  emptyArr.sort((a, b) => b.total - a.total);

  const WordThenNumArray = wordArr.concat(numArr);

  return WordThenNumArray.concat(emptyArr);
}

/**
 * Sorts the data array based on total interactions, alphabetics, and groups fields
 * @param  {Array} dataFromDatabse
 */
function sortDatabase(dataFromDatabase) {
  let counter = 0;
  const data = [];
  for (const row of dataFromDatabase) {
    // we treat only emails that are not tagged "noReply"
    if (row.dataValues.noReply === true) {
      continue;
    }

    //if for any reason we don't have names we should give empty string
    if (!row.dataValues.name || row.dataValues.name === null) {
      row.dataValues.name = [''];
    } else {
      // here are clean names
      const NameArray = handleNames(
        row.dataValues.name,
        row.dataValues.address
      );
      row.dataValues.name = NameArray.length === 0 ? [''] : NameArray;
    }
    // sum the sender + the total so we can have total interactions with this email
    row.dataValues.total =
      parseInt(row.dataValues.sender) + parseInt(row.dataValues.recipient);
    row.dataValues.type = '';

    if (
      !row.dataValues.Newsletter &&
      !row.dataValues.Transactional &&
      row.dataValues.name.every((val) => val !== '')
    ) {
      //if not transactional or newsletter, then find the type
      row.dataValues.type = findEmailAddressType(
        row.dataValues.address,
        row.dataValues?.name,
        row.dataValues.domain_type
      );
    }

    // count of transactional emails
    if (row.dataValues.Transactional) {
      counter += 1;
    }

    data.push(row.dataValues);
  }
  // return the count and the data
  return [sortDataUsingAlpha(data), counter];
}
module.exports = {
  findEmailAddressType,
  getEmails,
  getCountDB,
  deleteUserData,
  sortDatabase,
  getNoReplyEmails
};
