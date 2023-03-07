const { NOREPLY_EMAIL_ADDRESS_INCLUDES } = require('../constants');

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
      return 'professional';
    case 'provider':
      return 'personal';
    default:
      return '';
  }
}

/**
 * Checks if an email address can be tagged as no reply
 * @param emailAddress - The email address to check
 * @returns {Boolean}
 */
function isNoReply(emailAddress) {
  return NOREPLY_EMAIL_ADDRESS_INCLUDES.some((word) => {
    return emailAddress.toLowerCase().includes(word);
  });
}

function getEmailTags(email, domainType) {
  const emailTags = [];

  const emailType = findEmailAddressType(
    email.address,
    [email?.name],
    domainType
  );

  if (email && isNoReply(email.address)) {
    emailTags.push({ name: 'no-reply', reachable: 0, source: 'refined' });
  }

  if (emailType !== '') {
    emailTags.push({
      name: emailType,
      reachable: 1,
      source: 'refined'
    });
  }

  return emailTags;
}

module.exports = {
  getEmailTags
};
