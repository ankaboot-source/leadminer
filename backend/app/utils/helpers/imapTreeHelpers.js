/**
 * createFlatTreeFromImap - creates a readable flat array from tree object
 * @param  {object} imapTree - native imap tree
 * @return {array} Array of objects
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
  let folder = {};

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
 * @param {object} FlatTree - A flat array of objects to build a tree.
 * @param {string} userEmail - The email address of the user you want to get the data for.
 * @returns {array} an array with one object.
 * 
 * @example
 * // returns
 * [
 *  {
 *    label: 'email@example.com',
 *    children: [ [Object], [Object] ],
 *   totalEmails: 0
 *  }
 * ]
 */

function BuildFinaltTree(FlatTree, userEmail) {
  const readableTree = [];
  let totalInEmail = 0;

  Object.keys(FlatTree).forEach((key) => {

    if (FlatTree[`${key}`].parent) {
      if (FlatTree[`${key}`].parent.children) {
        FlatTree[`${key}`].parent.children.push(FlatTree[`${key}`]); 
      } else {
        FlatTree[`${key}`].parent.children = [FlatTree[`${key}`]]; 
      } 

      FlatTree[`${key}`].parent.total += FlatTree[`${key}`].total;

    } else {
      FlatTree[`${key}`].path = FlatTree[`${key}`].total > 0 ? FlatTree[`${key}`].path : '';
      readableTree.push(FlatTree[`${key}`]);
    }
    totalInEmail += FlatTree[`${key}`].total;
    delete FlatTree[`${key}`].parent;
    
  });
  return [{ label: userEmail, children: [...readableTree], total: totalInEmail }];
}

module.exports = {
  createFlatTreeFromImap,
  BuildFinaltTree
};
