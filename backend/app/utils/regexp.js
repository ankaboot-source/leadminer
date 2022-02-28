const regex = new RegExp(
  /((?<name>[\p{L}\p{M}.\w\s\d\s\(\),-]{1,})"*\s)*(<|\[)*(?<address>[A-Za-z0-9!#$%&'+\/=?^_`\{|\}~-]+(?:\.[A-Za-z0-9!#$%&'*+\/=?^_`\{|\}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)(>|\])*/gmu
);
//  /("*(?<name>[,\p{L}\p{M}\d\s\(\)-]{1,})"*\s)*(<|\[)*(mailto:)*(?<address>[A-Za-z0-9!#$%&'+\/=?^_`\{|\}~-]+(?:\.[A-Za-z0-9!#$%&'*+\/=?^_`\{|\}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9,\s])?)(>|\])*/dgimu
let domainList = require("./domains.json");
let domainsSet = new Set(domainList);

async function matchRegexp(ImapData) {
  let promise = new Promise((resolve, reject) => {
    let dataAfterRegEx;
    ImapData = ImapData.filter(
      (v, i, a) =>
        a.findIndex((t) => JSON.stringify(t) === JSON.stringify(v)) === i
    );
    dataAfterRegEx = ImapData.map((data, index) => {
      let ele = regex.exec(data);
      if (ele == null || ele["groups"] == null) {
        return null;
      } else {
        return ele["groups"];
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
exports.matchRegexp = matchRegexp;
exports.checkDomainType = checkDomainType;
