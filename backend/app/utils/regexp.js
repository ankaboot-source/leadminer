/* eslint-disable */
// const regex = new RegExp(
//   /((?<name>[\p{L}\p{M}',.\p{L}\p{M}\d\s\(\)-]{1,})"*\s)*(<|\[)*(?<address>[A-Za-z0-9!#$%&'+\/=?^_`\{|\}~-]+(?:\.[A-Za-z0-9!#$%&'*+\/=?^_`\{|\}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)(>|\])*/gimu
// );
const regex = new RegExp(
  /((?<name>[\p{L}\p{M}'.\p{L}\p{M}\d\s\(\)A-Za-z0-9!#$%&'*+\/=?^_`\{|\}~-]{1,})"*\s)*(<|\[)*(?<address>[A-Za-z0-9!#$%&'+\/=?^_`\{|\}~-]+(?:\.[A-Za-z0-9!#$%&'*+\/=?^_`\{|\}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)(>|\])*/gimu
);
const regexForbody = new RegExp(
  /(:(?<name>[\p{L}\p{M}'.\p{L}\p{M}\d\s\(\)A-Za-z0-9!#$%&'*+\/=?^_`\{|\}~-]{1,})"*\s)*(<|\[)*(?<address>[A-Za-z0-9!#$%&'+\/=?^_`\{|\}~-]+(?:\.[A-Za-z0-9!#$%&'*+\/=?^_`\{|\}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)(>|\])*/gimu
);
/* eslint-disable */
/* eslint-disable */
const regexForBody = new RegExp(
  /(:(?<name>[\p{L}\p{M}*',.\p{L}\p{M}\d\s\(\)-]{1,}))*(<|\[)*(?<address>[A-Za-z0-9!#$%&'+\/=?^_`\{|\}~-]+(?:\.[A-Za-z0-9!#$%&'*+\/=?^_`\{|\}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)(>|\])*/gimu
);
var fs = require("fs");
/* eslint-disable */
const logger = require("./logger")(module);
const ValidDomainsSet = require("./ValidDomains.json");
const InvalidDomainsSet = require("./InvalidDomains.json");
const dns = require("dns");
/**
 * After validating/invalidating dns in CheckDOmainType() we can store valid domains for a next use.
 * @param  {} emails Clean emails
 */
async function addDomainsToValidAndInvalid(emails) {
  emails.forEach((email) => {
    if (typeof email.email.address != "undefined") {
      let domain = email.email.address.split("@")[1];
      if (
        !ValidDomainsSet.domains.includes(domain) &&
        email.dnsValidity == "Valid"
      ) {
        console.log(domain);
        ValidDomainsSet.domains.push(domain);
      } else if (
        !InvalidDomainsSet.domains.includes(domain) &&
        email.dnsValidity == "Invalid"
      ) {
        InvalidDomainsSet.domains.push(domain);
      }
    }
  });
  fs.readFile(__dirname + "/ValidDomains.json", "utf8", (err, data) => {
    if (err) {
      throw err;
    } else {
      var json = JSON.stringify(ValidDomainsSet);
      console.log(ValidDomainsSet);
      fs.writeFile(__dirname + "/ValidDomains.json", json, (err) => {
        if (err) {
          console.log(err);
        } else {
          console.log("done");
        }
      });
    }
  });
  fs.readFile(__dirname + "/InvalidDomains.json", "utf8", (err, data) => {
    if (err) {
      throw err;
    } else {
      var json = JSON.stringify(InvalidDomainsSet);
      fs.writeFile(__dirname + "/InvalidDomains.json", json, (err) => {
        if (err) {
          console.log(err);
        } else {
          console.log("done");
        }
      });
    }
  });
}
function extractEmailsFromBody(data) {
  let reg = data.match(regexForBody);
  // console.log(reg, "heheheh");
  if (reg != null) {
    return [reg.join(",")];
  } else {
    return reg;
  }
}

/**
 * Using regEx extract clean mail address and a user name if available
 * @param  {object} ImapData
 */
function extractNameAndEmail(data) {
  //console.log(data);
  const getRegExp = (email, emailAfterRegEx) => {
    if (emailAfterRegEx) {
      return emailAfterRegEx.groups;
    } else if (email) {
      return {
        name: email[0].substring(0, email.indexOf("<")),
        address: email[0]
          .substring(email[0].indexOf("<"), email[0].length)
          .replace("<", "")
          .replace(">", ""),
      };
    }
  };
  let email = data[0].split(">");
  if (email[1]) {
    let dataWithManyEmails = email.map((emails) => {
      let Emails = emails.trim();
      let emailAfterRegEx = regex.exec(Emails);
      let result = getRegExp(emails, emailAfterRegEx);
      return result;
    });
    //console.log(dataWithManyEmails);
    return dataWithManyEmails;
  } else {
    let emailAfterRegEx = regex.exec(email);
    let result = getRegExp(email, emailAfterRegEx);
    return [result];
  }
}

function extractNameAndEmailForBody(data) {
  //console.log(data);
  const getRegExp = (email, emailAfterRegEx) => {
    //console.log(emailAfterRegEx, email);
    if (emailAfterRegEx) {
      return emailAfterRegEx.groups;
    }
  };
  let email = data[0].split(",");
  if (email[1]) {
    let dataWithManyEmails = email.map((emails) => {
      let Emails = emails.trim();
      //console.log(Emails);

      let emailAfterRegEx = regex.exec(Emails);
      //console.log(emailAfterRegEx);
      let result = getRegExp(emails, emailAfterRegEx);
      return result;
    });
    //console.log(dataWithManyEmails);
    return dataWithManyEmails;
  } else {
    let emailAfterRegEx = regex.exec(email);
    let result = getRegExp(email, emailAfterRegEx);
    return [result];
  }
}

/**
 * Check domain validity using dns, extracting the mx record
 * if MX record exists then it's valid
 * @param  {} collectedEmails
 */
async function checkDomainType(data) {
  let promises = data.map(async (email) => {
    if (email.email != null && typeof email.email.address != "undefined") {
      let domain = email.email.address.split("@")[1];
      if (typeof domain == "undefined") {
      } else {
        return new Promise((resolve, reject) => {
          if (ValidDomainsSet.domains.includes(domain)) {
            email.dnsValidity = "Valid";
            //console.log("helo");

            resolve(email);
          } else if (InvalidDomainsSet.domains.includes(domain)) {
            email.dnsValidity = "Invalid";
            resolve(email);
          } else {
            // return new Promise((resolve, reject) => {
            //   console.log(domain);
            //   dns.resolveMx(domain, function (err, addresses) {
            //     if (err) {
            //       email["dnsValidity"] = "Invalid";
            //       resolve(email);
            //     } else if (addresses) {
            //       email["dnsValidity"] = "Valid";
            //       resolve(email);
            //     }
            //   });
            // });

            dns.resolveMx(domain, (error, addresses) => {
              if (error) {
                //console.log("helo error");

                email["dnsValidity"] = "Invalid";
                resolve(email);
              }
              if (addresses) {
                email["dnsValidity"] = "Valid";
                //console.log("helo val");

                resolve(email);
              } else {
                //console.log("helo inval");
                email["dnsValidity"] = "Invalid";
                resolve(email);
              }
            });

            // dnsPromises
            //   .resolveMx(domain)
            //   .then((data) => {
            //     if (data) {
            //       email["dnsValidity"] = "Valid";
            //       resolve(email);
            //     } else {
            //       email["dnsValidity"] = "Invalid";
            //       resolve(email);
            //     }
            //   })
            //   .catch((err) => {
            //     email["dnsValidity"] = "Invalid";
            //     resolve(email);
            //   });
          }
        });
      }
    } else {
      return email;
    }
  });
  console.log("endddddddddd");
  return Promise.all(promises);
}

/**
 * returns an array of integers used in sending progress status
 * @param  {integer} total box total messages
 *
 */
async function EqualPartsForSocket(total) {
  const promise = new Promise((resolve, reject) => {
    let boxCount = total;
    const values = [];
    let n = boxCount > 1000 ? 10 : 6;
    while (boxCount > 0 && n > 0) {
      const a = Math.floor(boxCount / n);
      boxCount -= a;
      n--;
      values.push(a);
    }
    const Parts = [];
    values.reduce((prev, curr, i) => (Parts[i] = prev + curr), 0);
    resolve(Parts);
  });
  const result = await promise;
  return result;
}

/**
 * returns a path to a box, usefull for nested folders
 * @param  {object} obj folders tree as it is in imap
 * @param  {string} val folder name (eg:trash,spam...)
 * @param  {string} [path=""] initial path
 */
function getPath(obj, val, path) {
  path = path || "";
  let fullpath = "";
  for (const b in obj) {
    if (obj[b] === val) {
      return path;
    }
    if (typeof obj[b] === "object") {
      fullpath = getPath(obj[b], val, `${path}/${obj[b].label}`) || fullpath;
    }
  }
  return fullpath.replace("/undefined", "");
}

/**
 * extract folders name and prepare a clean tree
 * @param  {object} folders
 * @example
 * label : INBOX
 * children:
 *         lable: Work
 *         labled: Friends
 *         labeld: Newsletters
 */
function getBoxesAll(folders) {
  const finalFolders = [];
  let folder = {};
  const keys = Object.keys(folders);
  keys.forEach((key) => {
    if (folders[key].attribs.indexOf("\\HasChildren") > -1) {
      const children = getBoxesAll(folders[key].children);
      folder = {
        label: key,
        children,
      };
    } else {
      folder = {
        label: key,
      };
    }
    finalFolders.push(folder);
  });
  return finalFolders;
}

async function detectRegEx(data) {
  // let matchedData = data.match(regexmatch);
  // matchedData = [...matchedData.flat()];
  // dataAfterRegEx = matchedData.map((data) => {
  let dataAfterRegEx = data.map((email) => {
    let regEmail = regex.exec(email.email[0]);
    email.email =
      regEmail != null
        ? JSON.parse(JSON.stringify(regEmail.groups))
        : email.email[0];
    return email;
  });
  console.group(dataAfterRegEx);
  return dataAfterRegEx;
}

exports.extractNameAndEmail = extractNameAndEmail;
exports.checkDomainType = checkDomainType;
exports.EqualPartsForSocket = EqualPartsForSocket;
exports.getBoxesAll = getBoxesAll;
exports.getPath = getPath;
exports.addDomainsToValidAndInvalid = addDomainsToValidAndInvalid;
exports.detectRegEx = detectRegEx;
exports.extractEmailsFromBody = extractEmailsFromBody;
exports.extractNameAndEmailForBody = extractNameAndEmailForBody;
