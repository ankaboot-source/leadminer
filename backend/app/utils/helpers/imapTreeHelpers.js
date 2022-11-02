const objectScan = require('object-scan');

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

function createTreeFromImap(imapTree) {
  const readableTree = [];
  let folder = {};

  Object.keys(imapTree).forEach((key) => {
    if (imapTree[`${key}`].attribs.indexOf('\\HasChildren') > -1) {
      const children = createTreeFromImap(imapTree[`${key}`].children);
      folder = {
        label: key,
        children
      };
    } else {
      folder = {
        label: key
      };
    }
    readableTree.push(folder);
  });
  return readableTree;
}

/**
 * findPathPerFolder() takes the imaptree, a folder name, and a string path, and returns a full path string.
 * @param {object} imapTree - The tree structure of the IMAP folders
 * @param {string} folderName - The name of the folder you want to find the path for.
 * @param {string} path - The path to the folder.
 * @example path to testFolder3 is INBOX/testFolder1/testFolder2/testFolder3
 * @returns The full path of the folder name.
 */
function findPathPerFolder(imapTree, folderName, pathString) {
  const path = pathString || '';
  let fullpath = '';
  for (const folder in imapTree) {
    /* istanbul ignore else */
    if (imapTree[`${folder}`] === folderName) {
      return path;
    }
    if (typeof imapTree[`${folder}`] === 'object') {
      fullpath =
        findPathPerFolder(
          imapTree[`${folder}`],
          folderName,
          `${path}/${imapTree[`${folder}`].label}`
        ) || fullpath;
    } else {
      continue;
    }
  }
  return fullpath.replace('/undefined', '');
}

/**
 * Takes an IMAP tree and returns a new IMAP tree with the folder names replaced with their full
 * paths
 * @param {object} imapTree - The tree structure of the IMAP folders.
 * @param {object} originalTree - The tree structure of the IMAP folders.
 * @returns {object} The imapTree object.
 */
function addPathPerFolder(imapTree, originalTree) {
  Object.keys(imapTree).forEach((key) => {
    if (imapTree[`${key}`].children) {
      imapTree[`${key}`].path = findPathPerFolder(
        originalTree,
        imapTree[`${key}`].label,
        ''
      ).substring(1);
      addPathPerFolder(imapTree[`${key}`].children, originalTree);
    } else {
      imapTree[`${key}`].path = findPathPerFolder(
        originalTree,
        imapTree[`${key}`].label,
        ''
      ).substring(1);
    }
  });

  return imapTree;
}

/**
 * addChildrenTotalForParentFiles() takes an imapTree and a userEmail and returns an array with a single object that has a label of
 * the userEmail, a children array of the imapTree, and a total of the sum of all the totals in the
 * imapTree
 * @param {object} imapTree - The tree of folders and files that we want to add the total to.
 * @param {string} userEmail - The email address of the user you want to get the data for.
 * @returns {array} an array with one object. The object has a label property with the value of the userEmail
 * argument. The object also has a children property with the value of the imapTree argument. The
 * object also has a total property with the value of the total.sum property.
 */
function addChildrenTotalForParentFiles(imapTree, userEmail) {
  const total = objectScan(['**.{total,children}'], {
    joined: true,
    filterFn: ({ parent, property, value, context }) => {
      if (property === 'total') {
        parent.totalIndiv = parent.total;
      }
      if (property === 'children') {
        if (parent) {
          value.forEach((element) => {
            parent.total += element.total;
          });
        }
      }
      if (property === 'total') {
        context.sum += value;
      }
    }
  })(imapTree, { sum: 0 });

  return [{ label: userEmail, children: [...imapTree], total: total.sum }];
}

module.exports = {
  createTreeFromImap,
  addPathPerFolder,
  addChildrenTotalForParentFiles
};
