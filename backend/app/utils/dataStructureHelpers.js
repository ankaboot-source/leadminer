const objectScan = require("object-scan");
const freeProviders = require("./FreeProviders.json");
const disposable = require("./Disposable.json");
const NOREPLY = [
  "accusereception",
  "alerts",
  "alert",
  "auto-confirm",
  "donotreply",
  "do-notreply",
  "do-not-reply",
  "FeedbackForm",
  "mail daemon",
  "maildaemon",
  "mailer daemon",
  "mailer-daemon",
  "mailermasters",
  "ne_pas_repondre",
  "nepasrepondre",
  "ne-pas-repondre",
  "no.reply",
  "no_reply",
  "noreply",
  "no-reply",
  "notification",
  "notifications",
  "notifications-noreply",
  "notify",
  "pasdereponse",
  "password",
  "reply-",
  "send-as-noreply",
  "support",
  "systemalert",
  "unsubscribe",
  "wordpress",
];
/**
 * Create readable tree object
 * @param  {object} imapTree - native imap tree
 * @return {object} readable tree object
 * @example
 * // returns
 * label : INBOX
 * children:
 *         lable: Work
 *         labled: Friends
 *         labeld: Newsletters
 * getBoxesAll({NAME:"INBOX",attribs:"\\HasChildren"})
 */
function createReadableTreeObjectFromImapTree(imapTree) {
  const readableTree = [];
  let folder = {};
  Object.keys(imapTree).forEach((key) => {
    if (imapTree[key].attribs.indexOf("\\HasChildren") > -1) {
      const children = createReadableTreeObjectFromImapTree(
        imapTree[key].children
      );
      folder = {
        label: key,
        children,
      };
    } else {
      folder = {
        label: key,
      };
    }
    readableTree.push(folder);
  });
  return readableTree;
}

/**
 * It takes an IMAP tree and returns a new IMAP tree with the folder names replaced with their full
 * paths
 * @param {object} imapTree - The tree structure of the IMAP folders.
 * @param {object} originalTree - The tree structure of the IMAP folders.
 * @returns {object} The imapTree object.
 */
function addPathPerFolder(imapTree, originalTree) {
  Object.keys(imapTree).forEach((key) => {
    if (imapTree[key].children) {
      imapTree[key].path = findPathPerFolder(
        originalTree,
        imapTree[key].label,
        ""
      ).substring(1);
      addPathPerFolder(imapTree[key].children, originalTree);
    } else {
      imapTree[key].path = findPathPerFolder(
        originalTree,
        imapTree[key].label,
        ""
      ).substring(1);
    }
  });

  /**
   * It takes the imaptree, a folder name, and a string path, and returns a full path string.
   * @param imapTree - The tree structure of the IMAP folders
   * @param folderName - The name of the folder you want to find the path for.
   * @param path - The path to the folder.
   * @returns The full path of the folder name.
   */
  function findPathPerFolder(imapTree, folderName, path) {
    path = path || "";
    let fullpath = "";
    for (const folder in imapTree) {
      /* istanbul ignore else */
      if (imapTree[folder] === folderName) {
        return path;
      }
      if (typeof imapTree[folder] === "object") {
        fullpath =
          findPathPerFolder(
            imapTree[folder],
            folderName,
            `${path}/${imapTree[folder].label}`
          ) || fullpath;
      } else {
        continue;
      }
    }
    return fullpath.replace("/undefined", "");
  }
  return imapTree;
}

/**
 * It takes an imapTree and a userEmail and returns an array with a single object that has a label of
 * the userEmail, a children array of the imapTree, and a total of the sum of all the totals in the
 * imapTree
 * @param {object} imapTree - The tree of folders and files that we want to add the total to.
 * @param {string} userEmail - The email address of the user you want to get the data for.
 * @returns {array} an array with one object. The object has a label property with the value of the userEmail
 * argument. The object also has a children property with the value of the imapTree argument. The
 * object also has a total property with the value of the total.sum property.
 */
function addChildrenTotalForParentFiles(imapTree, userEmail) {
  const total = objectScan(["**.{total,children}"], {
    joined: true,
    filterFn: ({ parent, gparent, property, value, context }) => {
      if (property == "total") {
        parent["totalIndiv"] = parent.total;
      }
      if (property == "children") {
        if (parent) {
          value.map((element) => {
            parent.total += element.total;
          });
        }
      }
      if (property == "total") {
        context.sum += value;
      }
    },
  })(imapTree, { sum: 0 });
  return [{ label: userEmail, children: [...imapTree], total: total.sum }];
}

/**
 * It takes an email address as a string and returns true if the email address does not contain any of
 * the words in the NOREPLY array
 * @param address - The email address to check
 * @returns A boolean value.
 */
function IsNotNoReply(address) {
  const noReply = NOREPLY.filter((word) =>
    address.toLowerCase().includes(word.toLowerCase())
  );
  if (noReply.length > 0) {
    return false;
  } else {
    return true;
  }
}

/**
 * If the domain is in the freeProviders array, return true. If the domain is in the disposable array,
 * return false. If the domain is not in either array, return false
 * @param address - The email address to check it domain.
 * @returns A boolean value.
 */
function checkDomainIsOk(address) {
  const domain = address.split("@")[1];
  if (freeProviders.includes(domain)) {
    return true;
  } else if (disposable.includes(domain)) {
    return false;
  } else {
    // TODO : check mx
    return true;
  }
}
module.exports = {
  createReadableTreeObjectFromImapTree,
  addPathPerFolder,
  addChildrenTotalForParentFiles,
  IsNotNoReply,
  checkDomainIsOk,
};
