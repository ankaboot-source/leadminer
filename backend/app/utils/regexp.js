/* eslint-disable */
const regex = new RegExp(
  /((?<name>[\p{L}\p{M}.\p{L}\p{M}\d\s\(\)-]{1,})"*\s)*(<|\[)*(?<address>[A-Za-z0-9!#$%&'+\/=?^_`\{|\}~-]+(?:\.[A-Za-z0-9!#$%&'*+\/=?^_`\{|\}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)(>|\])*/imu
);
/* eslint-disable */
/* eslint-disable */
const regexmatch = new RegExp(
  /((?<name>[\p{L}\p{M}.\p{L}\p{M}\d\s\(\)-]{1,})"*\s)*(<|\[)*(?<address>[A-Za-z0-9!#$%&'+\/=?^_`\{|\}~-]+(?:\.[A-Za-z0-9!#$%&'*+\/=?^_`\{|\}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)(>|\])*/gimu
);
/* eslint-disable */
const domainList = require("./domains.json");
const domainsSet = new Set(domainList);
const dns = require("dns");
const { SlowBuffer } = require("buffer");
const { resolve } = require("path");

async function matchRegexp(ImapData) {
  const promise = new Promise((resolve, reject) => {
    let dataAfterRegEx;
    let matchedData = [];
    const imapData = ImapData.filter(
      (v, i, a) =>
        a.findIndex((t) => JSON.stringify(t) === JSON.stringify(v)) === i
    );
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

async function checkDomainType(collectedEmails) {
  let done = false;
  const allPromises = collectedEmails.map(async (email) => {
    let domain = email.address.split("@")[1];
    console.log(email);
    return new Promise((resolve, reject) => {
      dns.resolve(domain, "MX", async function (err, addresses) {
        if (err) {
          email.domain = "Invalid";
          resolve((email.domain = "Invalid"));
        } else if (addresses && addresses.length > 0) {
          email.domain = "Valid";
          resolve((email.domain = "Valid"));
        }
      });
    });
  });
  await Promise.all(allPromises).then((result) => {
    done = true;
  });
  if (done) {
    return collectedEmails;
  }
}
async function EqualPartsForSocket(total) {
  const promise = new Promise((resolve, reject) => {
    let boxCount = total;
    const values = [];
    let n = boxCount > 700 ? 10 : 2;
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
exports.matchRegexp = matchRegexp;
exports.checkDomainType = checkDomainType;
exports.EqualPartsForSocket = EqualPartsForSocket;
exports.getBoxesAll = getBoxesAll;
exports.getPath = getPath;
