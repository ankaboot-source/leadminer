const casesObject = [
  [1, 0, 100],
  [2, 101, 399],
  [3, 400, 799],
  [5, 800, 14],
  [10, 500, 999],
  [15, 1000, 7999],
  [50, 8000, 19999],
  [500, 20000, 60000],
  [500, 60001, 100000],
  [1000, 100001, 500001],
];
/**
 * Returns the path to a box(folder), usefull for nested folders.
 * @param  {object} obj A folders tree as it is in imap
 * @param  {string} val A folder name (eg:trash,spam...)
 * @param  {string} [path=""] The initial path
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
 * Extract folders names and prepare the associated tree.
 * @param  {object} Object Represents the folders names
 * @example
 * // returns
 * label : INBOX
 * children:
 *         lable: Work
 *         labled: Friends
 *         labeld: Newsletters
 * getBoxesAll({NAME:"INBOX",attribs:"\\HasChildren"})
 */
function getBoxesAll(folders) {
  const finalFolders = [];
  let folder = {};
  Object.keys(folders).forEach((key) => {
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
/**
 * Extract boxes from folders tree.
 * @param  {} req.query Selected boxes and folder tree from client.
 * @example
 * folders = {
 *     label : INBOX
 *       children:
 *         lable: Work
 *         labled: Friends
 *         labeld: Newsletters
 * }
 * // retruns boxes = [INBOX, INBOX/Work, INBOX/Friends, INBOX/Newsletters]
 */
function getBoxesAndFolders(userQuery) {
  const folders = userQuery.folders.map((element) => {
    return JSON.parse(element);
  });
  const boxes = userQuery.boxes.map((element) => {
    const path = getPath({ ...folders }, element);
    return path.substring(1);
  });
  return boxes;
}

/**
 * Returns an array of integers used in sending progress status.
 * @param  {integer} total box total messages
 * @returns {Array}
 *
 */
function EqualPartsForSocket(total) {
  function inRange(n, nStart, nEnd) {
    if (n >= nStart && n <= nEnd) return true;
    else return false;
  }
  let boxCount = total;
  const values = [];
  let n = 350;
  for (const i of casesObject) {
    if (inRange(boxCount, i[1], i[2])) {
      n = i[0];
      break;
    } else if (i == casesObject[casesObject.length - 1]) {
      break;
    } else {
      continue;
    }
  }
  while (boxCount > 0 && n > 0) {
    const a = Math.floor(boxCount / n);
    boxCount -= a;
    n--;
    values.push(a);
  }
  const Parts = [];
  values.reduce((prev, curr, i) => (Parts[i] = prev + curr), 0);
  return Parts;
}

function findEmailAddressType(emailAddress, UserName, domainType) {
  let domainAndUserName = emailAddress.split("@");
  function getScore(DomainAndUserName) {
    let splittedUserName = UserName.split(" ");
    let UsernameWithoutSpace = UserName.replaceAll(/ /g, "").toLowerCase();
    let domainAndUserName = DomainAndUserName.substring(
      0,
      UsernameWithoutSpace.length
    ).toLowerCase();
    let length = domainAndUserName.length;
    let actualScore = length; // start with full points
    let i = 0;

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
  //array that contains two values, ex: [user,gmail.com] for the email user@gmail.com
  if (UserName.length > 0) {
    if (domainType == "custom" && getScore(domainAndUserName[1]) > 40) {
      return "Company";
    }
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
/**
 * Sorts the data array based on total interactions, alphabetics, and groups fields
 * @param  {Array} dataFromDatabse
 */
function sortDatabase(dataFromDatabse) {
  const data = dataFromDatabse.map((row) => {
    if (!row.dataValues.name || row.dataValues.name == null) {
      row.dataValues["name"] = [""];
    } else {
      const NameArray = [];
      row.dataValues["name"].map((name) => {
        const Name = name
          .replaceAll('"', "")
          .replaceAll("'", "")
          .replaceAll("/", "")
          .trim();
        if (Name != row.dataValues.address) {
          if (
            NameArray.filter((str) =>
              str.toLowerCase().includes(Name.toLowerCase())
            ).length == 0
          ) {
            NameArray.push(Name);
          }
        }
      });
      NameArray.length == 0
        ? (row.dataValues["name"] = [""])
        : (row.dataValues["name"] = NameArray);
    }

    row.dataValues["recipient"] =
      (parseInt(row.dataValues?.["cc"]) ?? 0) +
      (parseInt(row.dataValues?.["bcc"]) ?? 0) +
      (parseInt(row.dataValues?.["to"]) ?? 0);
    row.dataValues["sender"] =
      (parseInt(row.dataValues?.from) ?? 0) +
      (parseInt(row.dataValues?.["reply_to"]) ?? 0);
    row.dataValues["body"] = parseInt(row.dataValues?.body) ?? 0;
    row.dataValues["total"] =
      row.dataValues["sender"] + row.dataValues["recipient"];
    row.dataValues["type"] = [];
    if (row.dataValues.newsletter != 0 || row.dataValues.transactional != 0) {
      if (
        row.dataValues.newsletter != 0 &&
        row.dataValues.newsletter == row.dataValues["from"]
      ) {
        row.dataValues["type"].push("Newsletter");
      }
      if (
        row.dataValues.transactional != 0 &&
        row.dataValues.transactional == row.dataValues["from"]
      ) {
        row.dataValues["type"].push("Transactional");
      }
    } else if (row.dataValues["name"] != [""]) {
      row.dataValues["type"].push(
        findEmailAddressType(
          row.dataValues.address,
          row.dataValues?.name?.[0],
          row.dataValues.domain_type
        )
      );
    }
    return row.dataValues;
  });
  const wordArr = [];
  const numArr = [];
  const emptyArr = [];
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
  const dataend = wordArr.concat(numArr);
  const sorted = dataend.concat(emptyArr);
  return [...sorted];
}
exports.sortDatabase = sortDatabase;
exports.getBoxesAndFolders = getBoxesAndFolders;
exports.getBoxesAll = getBoxesAll;
exports.EqualPartsForSocket = EqualPartsForSocket;
exports.getPath = getPath;
