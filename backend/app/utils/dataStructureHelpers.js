/**
 * create readable tree object
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
 * @param  {object} imapTree A folders tree as it is in imap
 * @param  {object} originalTree the imaptree but do not change needed for recursevity.
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
   * @param  {object} imapTree A folders tree as it is in imap
   * @param  {string} folderName A folder name (eg:trash,spam,INBOX...)
   * @param  {string} [path=""] The initial path
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
module.exports = {
  createReadableTreeObjectFromImapTree,
  addPathPerFolder,
};
