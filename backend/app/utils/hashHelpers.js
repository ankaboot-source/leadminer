const crypto = require("crypto");
const secret = "abcdefg";

function hashEmail(emailAddress) {
  return crypto.createHmac("sha256", secret).update(emailAddress).digest("hex");
}

module.exports = {
  hashEmail,
};
