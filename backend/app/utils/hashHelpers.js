const crypto = require("crypto");

//secret used in hash
const secret = process.env.HASH_SECRET;

/**
 * hashEmail takes an email address, runs it through a cryptographic hash function, and returns the result
 * @param emailAddress - The email address to hash.
 * @returns A hash of the email address.
 */
function hashEmail(emailAddress) {
  return crypto.createHmac("sha256", secret).update(emailAddress).digest("hex");
}

module.exports = {
  hashEmail,
};
