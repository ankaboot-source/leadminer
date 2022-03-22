/* eslint-disable */
const regex = new RegExp(
  /((?<name>[\p{L}\p{M}.\p{L}\p{M}\d\s\(\)-]{1,})"*\s)*(<|\[)*(?<address>[A-Za-z0-9!#$%&'+\/=?^_`\{|\}~-]+(?:\.[A-Za-z0-9!#$%&'*+\/=?^_`\{|\}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)(>|\])*/imu
);
/* eslint-disable */
/* eslint-disable */
const regexmatch = new RegExp(
  /((?<name>[\p{L}\p{M}.\p{L}\p{M}\d\s\(\)-]{1,})"*\s)*(<|\[)*(?<address>[A-Za-z0-9!#$%&'+\/=?^_`\{|\}~-]+(?:\.[A-Za-z0-9!#$%&'*+\/=?^_`\{|\}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)(>|\])*/gimu
);
var fs = require("fs");
/* eslint-disable */
const { emailsInfos } = require("../models");
const logger = require("./logger")(module);
const { Op } = require("sequelize");
const ValidDomainsSet = require("./ValidDomains.json");
const InvalidDomainsSet = require("./InvalidDomains.json");
const dns = require("dns");

/**
 * After validating/invalidating dns in CheckDOmainType() we can store valid domains for a next use.
 * @param  {} emails Clean emails
 */
function addDomainsToValidAndInvalid(emails) {
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
        email.domain == "Invalid"
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

/**
 * Using regEx extract clean mail address and a user name if available
 * @param  {object} ImapData
 */
async function matchRegexp(ImapData) {
  const promise = new Promise((resolve, reject) => {
    let dataAfterRegEx;
    let matchedData = [];
    const imapData = [...new Set(ImapData)];
    imapData.map((data) => {
      matchedData.push(data.match(regexmatch));
    });
    matchedData = [...matchedData.flat()];
    dataAfterRegEx = matchedData.map((data) => {
      const email = regex.exec(data);
      if (email == null || email.groups == null) {
        return null;
      }
      return email.groups;
    });
    // remove null values then return data
    dataAfterRegEx = dataAfterRegEx.filter((item) => Boolean(item));
    // remove duplicates
    dataAfterRegEx = dataAfterRegEx.filter(
      (el, index, array) =>
        array.findIndex((t) => t.address == el.address) == index
    );
    resolve(dataAfterRegEx);
  });
  const result = await promise;
  return result;
}

/**
 * Check domain validity using dns, extracting the mx record
 * if MX record exists then it's valid
 * @param  {} collectedEmails
 */
async function checkDomainType(data) {
  let done = false;
  const allPromises = data.map((email) => {
    if (email.email == null && typeof email.email.address == "undefined") {
      console.log(email);
    }
    if (email.email != null && typeof email.email.address != "undefined") {
      console.log(email.email.address);
      let domain = email.email.address.split("@")[1];
      if (ValidDomainsSet.domains.includes(domain)) {
        email.dnsValidity = "Valid";
        return;
      } else if (InvalidDomainsSet.domains.includes(domain)) {
        email.dnsValidity = "Invalid";
        return;
      } else {
        return new Promise((resolve, reject) => {
          dns.resolveMx(domain, async function (err, addresses) {
            if (err) {
              email.dnsValidity = "Invalid";
              resolve((email.dnsValidity = "Invalid"));
            } else if (addresses) {
              email.dnsValidity = "Valid";
              resolve((email.dnsValidity = "Valid"));
            }
          });
        });
      }
    } else {
      return;
    }
  });
  await Promise.all(allPromises).then(() => {
    done = true;
  });
  if (done) {
    return data;
  }
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

function detectRegEx(data) {
  // let matchedData = data.match(regexmatch);
  // matchedData = [...matchedData.flat()];
  // dataAfterRegEx = matchedData.map((data) => {
  const email = regex.exec(data);
  if (email == null || email.groups == null) {
    return null;
  }
  return email.groups;
}
async function databaseQualification(data) {
  let dataAfterRegEx = data.map((email) => {
    email.email =
      detectRegEx(email.email) != null
        ? JSON.parse(JSON.stringify(detectRegEx(email.email)))
        : email.email;
    return email;
  });
  //console.log(dataAfterRegEx);
  let dataAfterCheckDomain = await checkDomainType(dataAfterRegEx);
  console.log(dataAfterCheckDomain);
  let promises = [];
  //var allEmails = [];
  const allEmails = await emailsInfos.findAll();
  console.log(JSON.parse(JSON.stringify(allEmails)));

  dataAfterCheckDomain.forEach(async (data) => {
    await emailsInfos
      .findOne({
        where: {
          "email.address": {
            [Op.eq]: data.email.address,
          },
        },
      })
      .then(async (message) => {
        //console.log(message);
        if (message != null) {
          //console.log(message);
          if (!message.msgId.includes(data.msgId)) {
            message.msgId.push(data.msgId);
            console.log(message.msgId);
          } else if (!message.field.includes(data.field)) {
            message.field.push(data.field);
            console.log(message.field);
          } else if (!message.folder.includes(data.folder)) {
            message.folder.push(data.folder);
          }
          //console.log(message);

          promises.push(
            emailsInfos.update(
              {
                msgId: message.msgId,
                folder: message.folder,
                field: message.field,
              },
              {
                where: {
                  "email.address": {
                    [Op.eq]: data.email.address,
                  },
                },
              }
            )
          );
        } else {
          //console.log(regemail);

          let EmailReadyTobeStored = {
            email: data.email,
            field: [data.field],
            msgId: [data.msgId],
            folder: [data.folder],
            type: "email header",
            dnsValidity: data.domain,
          };

          await emailsInfos
            .create(EmailReadyTobeStored)
            .then(() => {
              console.log("done");
            })
            .catch((err) => {
              logger.error(`can't store data ${err}`);
            });
        }
      });
  });
  await Promise.all(promises);
  const alldata = await emailsInfos.findAll();
  return JSON.parse(JSON.stringify(alldata));
}
exports.matchRegexp = matchRegexp;
exports.checkDomainType = checkDomainType;
exports.EqualPartsForSocket = EqualPartsForSocket;
exports.getBoxesAll = getBoxesAll;
exports.getPath = getPath;
exports.addDomainsToValidAndInvalid = addDomainsToValidAndInvalid;
exports.databaseQualification = databaseQualification;
