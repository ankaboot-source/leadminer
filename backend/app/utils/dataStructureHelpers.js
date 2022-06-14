const objectScan = require("object-scan");

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
 * Add a property 'path' to the folder objects.
 * @param  {object} imapTree A folders tree as it is in imap.
 * @param  {object} originalTree the imaptree but do not change needed for recursevity.
 * @returns {object} imaptree with new "path" field for each folder.
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
   * Find the path for a given folder.
   * @param  {object} imapTree A folders tree as it is in imap.
   * @param  {string} folderName A folder name (eg:trash,spam,INBOX...).
   * @param  {string} [path=""] The initial path.
   * @returns {object} the exact path for a given folder
   */
  function findPathPerFolder(imapTree, folderName, path) {
    path = path || "";
    let fullpath = "";
    for (const folder in imapTree) {
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
      }
    }
    return fullpath.replace("/undefined", "");
  }
  return imapTree;
}
/**
 * Add the current imapConnection associated email and adds total for parents.
 * @param  {} imapTree formatted imap tree.
 * @param  {} userEmail current imap user associated with the connection.
 * @returns {array} imap tree with totalIndiv field that sumup child total.
 */
function addChildrenTotalForParentFiles(imapTree, userEmail) {
  let total = objectScan(["**.{total,children}"], {
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
function mergeEmailsObjectsFromHeaderAndBody(
  emailsObjectsFromHeader,
  emailsObjectsFromBody
) {
  let allEmails = [...emailsObjectsFromBody, ...emailsObjectsFromHeader];
  console.log(allEmails);
}
module.exports = {
  createReadableTreeObjectFromImapTree,
  addPathPerFolder,
  addChildrenTotalForParentFiles,
  mergeEmailsObjectsFromHeaderAndBody,
};
