const regex = new RegExp(
  /((?<name>[\p{L}\p{M}.\p{L}\p{M}\d\s\(\)-]{1,})"*\s)*(<|\[)*(?<address>[A-Za-z0-9!#$%&'+\/=?^_`\{|\}~-]+(?:\.[A-Za-z0-9!#$%&'*+\/=?^_`\{|\}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)(>|\])*/imu
);
const regexmatch = new RegExp(
  /((?<name>[\p{L}\p{M}.\p{L}\p{M}\d\s\(\)-]{1,})"*\s)*(<|\[)*(?<address>[A-Za-z0-9!#$%&'+\/=?^_`\{|\}~-]+(?:\.[A-Za-z0-9!#$%&'*+\/=?^_`\{|\}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)(>|\])*/gimu
);

//  /("*(?<name>[,\p{L}\p{M}\d\s\(\)-]{1,})"*\s)*(<|\[)*(mailto:)*(?<address>[A-Za-z0-9!#$%&'+\/=?^_`\{|\}~-]+(?:\.[A-Za-z0-9!#$%&'*+\/=?^_`\{|\}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9,\s])?)(>|\])*/dgimu
let domainList = require("./domains.json");
let domainsSet = new Set(domainList);

async function matchRegexp(ImapData) {
  let promise = new Promise((resolve, reject) => {
    let dataAfterRegEx;
    let matchedData = [];
    imapData = ImapData.filter(
      (v, i, a) =>
        a.findIndex((t) => JSON.stringify(t) === JSON.stringify(v)) === i
    );
    imapData.map((data, index) => {
      matchedData.push(data.match(regexmatch));
    });
    matchedData = [...matchedData.flat()];
    dataAfterRegEx = matchedData.map((data) => {
      let email = regex.exec(data);
      if (email == null || email["groups"] == null) {
        return null;
      } else {
        return email["groups"];
      }
    });
    // remove null values then return data
    dataAfterRegEx = dataAfterRegEx.filter((item) => {
      return Boolean(item);
    });
    // remove duplicates
    dataAfterRegEx = dataAfterRegEx.filter(
      (el, index, array) =>
        array.findIndex((t) => t.address == el.address) == index
    );
    //console.log(dataAfterRegEx);

    resolve(dataAfterRegEx);
  });
  let result = await promise;
  return result;
}

async function checkDomainType(collectedEmails) {
  let promise = new Promise((resolve, reject) => {
    //
    collectedEmails.map((email) => {
      if (
        domainsSet.has(
          email.address.substring(email.address.lastIndexOf("@") + 1)
        )
      ) {
        email["type"] = "Personal";
      } else {
        email["type"] = "Business";
      }
    });
    resolve(collectedEmails);
  });
  let result = await promise;
  return result;
}
async function EqualPartsForSocket(total) {
  let promise = new Promise((resolve, reject) => {
    let boxCount = total;
    var values = [];
    let n = boxCount > 700 ? 30 : 3;
    while (boxCount > 0 && n > 0) {
      var a = Math.floor(boxCount / n);
      boxCount -= a;
      n--;
      values.push(a);
    }
    let new_array = [];
    values.reduce((prev, curr, i) => (new_array[i] = prev + curr), 0);
    resolve(new_array);
  });
  let result = await promise;
  return result;
}
function getPath(obj, val, path, delimiter) {
  path = path || "";
  var fullpath = "";
  for (var b in obj) {
    if (obj[b] === val) {
      return path;
    } else if (typeof obj[b] === "object") {
      fullpath = getPath(obj[b], val, path + "/" + obj[b].label) || fullpath;
    }
  }
  console.log(fullpath);
  return fullpath.replace("/undefined", "");
}
function getBoxesAll(folders) {
  //console.log(folders);
  var FOLDERS = [];
  var folder = {};
  const keys = Object.keys(folders);
  keys.forEach((key, index) => {
    //console.log(index);
    if (folders[key].attribs.indexOf("\\HasChildren") > -1) {
      var children = getBoxesAll(folders[key].children);
      folder = {
        label: key,
        children: children,
      };
    } else {
      folder = {
        label: key,
      };
    }

    FOLDERS.push(folder);
  });
  return FOLDERS;
}
exports.matchRegexp = matchRegexp;
exports.checkDomainType = checkDomainType;
exports.EqualPartsForSocket = EqualPartsForSocket;
exports.getBoxesAll = getBoxesAll;
exports.getPath = getPath;
