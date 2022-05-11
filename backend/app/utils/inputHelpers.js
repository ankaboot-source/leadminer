// async function EqualPartsForSocket(total) {
//   const promise = new Promise((resolve, reject) => {
//     let boxCount = total;
//     const values = [];
//     let n = boxCount > 1000 ? 10 : 5;
//     while (boxCount > 0 && n > 0) {
//       const a = Math.floor(boxCount / n);
//       boxCount -= a;
//       n--;
//       values.push(a);
//     }
//     const Parts = [];
//     values.reduce((prev, curr, i) => (Parts[i] = prev + curr), 0);
//     resolve(Parts);
//   });
//   let result = await promise;
//   return result;
// }
const casesObject = [
  [1, 0, 10],
  [2, 11, 50],
  [5, 51, 99],
  [8, 100, 499],
  [10, 500, 999],
  [20, 1000, 7999],
  [30, 8000, 19999],
  [42, 20000, 60000],
  [50, 60000, 10000],
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
  for (let b in obj) {
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
  let finalFolders = [];
  let folder = {};
  let keys = Object.keys(folders);
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
  let folders = userQuery.folders.map((element) => {
    return JSON.parse(element);
  });
  let boxes = userQuery.boxes.map((element) => {
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
  console.log(total);
  function inRange(n, nStart, nEnd) {
    if (n >= nStart && n <= nEnd) return true;
    else return false;
  }
  let boxCount = total;
  const values = [];
  let n;
  for (let i of casesObject) {
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
  console.log(Parts);
  return Parts;
}
/**
 * Sorts the virtual database array based on total interactions, alphabetics, and groups fields
 * @param  {Array} database
 */
function sortDatabase(database) {
  let data = database.map((row) => {
    if (!Object.hasOwnProperty.bind(row.email)("name")) {
      row.email["name"] = "";
    } else if (!row.email.name) {
      row.email["name"] = "";
    }
    row.email.name = row.email.name.replace(/"/g, ``);
    row.field["total"] = 0;
    let countSender = 0;
    let countbody = 0;
    let countrecipient = 0;
    Object.keys(row.field).map((field) => {
      if (field.includes("from") || field.includes("reply-to")) {
        countSender += row.field[field];
      } else if (
        field.includes("cc") ||
        field.includes("to") ||
        field.includes("bcc")
      ) {
        countrecipient += row.field[field];
      } else {
        countbody += row.field[field];
      }
    });
    row.field["recipient"] = countrecipient;
    row.field["body"] = countbody;
    row.field["sender"] = countSender;
    row.field["total"] = countSender + countbody + countrecipient;
    return row;
  });
  var wordArr = [];
  var numArr = [];
  var emptyArr = [];
  data.forEach((el) => {
    if (Number(el.email.name.charAt(0))) {
      numArr.push(el);
    } else if (el.email.name != "") {
      wordArr.push(el);
    } else {
      emptyArr.push(el);
    }
  });
  wordArr.sort((a, b) => {
    return (
      !a.email.name - !b.email.name || a.email.name.localeCompare(b.email.name)
    );
  });
  wordArr.sort((a, b) => b.field.total - a.field.total);
  numArr.sort((a, b) => a - b);
  emptyArr.sort((a, b) => b.field.total - a.field.total);
  let dataend = wordArr.concat(numArr);
  let sorted = dataend.concat(emptyArr);

  return [...sorted];
}
exports.sortDatabase = sortDatabase;
exports.getBoxesAndFolders = getBoxesAndFolders;
exports.getBoxesAll = getBoxesAll;
exports.EqualPartsForSocket = EqualPartsForSocket;
exports.getPath = getPath;
