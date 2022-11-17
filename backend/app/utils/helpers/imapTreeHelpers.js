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

  Object.keys(imapTree).forEach((key) => {

    const folder = {
      label: key,
      path: currentParent ? `${currentParent.path }/${ key}` : key,
      parent: currentParent
    };

    if (imapTree[`${key}`].children) {
      readableTree.push(folder, ...createFlatTreeFromImap(imapTree[`${key}`].children, folder));
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

function BuildFinaltTree(flatTree, userEmail) {
  const readableTree = [];
  let totalInEmail = 0;

  Object.keys(flatTree).forEach((key) => {

    if (flatTree[`${key}`].parent) {
      if (flatTree[`${key}`].parent.children) {
        flatTree[`${key}`].parent.children.push(flatTree[`${key}`]); 
      } else {
        flatTree[`${key}`].parent.children = [flatTree[`${key}`]]; 
      } 

      flatTree[`${key}`].parent.total += flatTree[`${key}`].total;

    } else {
      flatTree[`${key}`].path = flatTree[`${key}`].total > 0 ? flatTree[`${key}`].path : '';
      readableTree.push(flatTree[`${key}`]);
    }
    totalInEmail += flatTree[`${key}`].total;
    delete flatTree[`${key}`].parent;
    
  });
  return [{ label: userEmail, children: [...readableTree], total: totalInEmail }];
}

module.exports = {
  createFlatTreeFromImap,
  BuildFinaltTree
};
