/**
 * createFlatTreeFromImap - creates a readable flat array from tree object
 * @param  {object[]} imapTree - native imap tree
 * @return {{label: string, path: string, parent: object}[]} Array of objects
 * @example
 * // returns
 * [
 *  {label : INBOX, path: 'INBOX', parent: {}},
 *  ...
 * ]
 * getBoxesAll({NAME:"INBOX",attribs:"\\HasChildren", ...})
 */

function createFlatTreeFromImap(imapTree, currentParent) {
  const readableTree = [];

  Object.keys(imapTree).forEach((folderLabel) => {
    const folder = {
      label: folderLabel,
      path:
        currentParent !== null
          ? `${currentParent.path}/${folderLabel}`
          : folderLabel,
      parent: currentParent
    };

    if (imapTree[`${folderLabel}`].children) {
      readableTree.push(
        folder,
        ...createFlatTreeFromImap(imapTree[`${folderLabel}`].children, folder)
      );
    } else {
      readableTree.push(folder);
    }
  });
  return readableTree;
}

/**
 * BuildFinaltTree() takes a flat array of objects and a userEmail. Then builds the flat array to a Tree object
 * and returns an array with a single object that has a label of the userEmail, a children array of the Tree, and a total.
 * @param {{label: string, path: string, parent: object, total: number}[]} flatTree - A flat array of objects to build a tree.
 * @param {string} userEmail - The email address of the user you want to get the data for.
 * @returns {label: string, children: object[], total: number} an array with one object.
 *
 * @example
 * // returns
 * [
 *  {
 *    label: 'email@example.com',
 *    children: [ [Object], [Object] ],
 *    total: 0
 *  }
 * ]
 */

function buildFinalTree(flatTree, userEmail) {
  const readableTree = [];
  let totalInEmail = 0;

  for (const box of flatTree) {
    if (box.parent) {
      if (box.parent.children) {
        box.parent.children.push(box);
      } else {
        box.parent.children = [box];
      }
      box.parent.cumulativeTotal += box.total;
    } else {
      readableTree.push(box);
    }
    totalInEmail += box.total;
    delete box.parent;
  }

  return [
    { label: userEmail, children: [...readableTree], total: totalInEmail }
  ];
}

module.exports = {
  createFlatTreeFromImap,
  buildFinalTree
};
