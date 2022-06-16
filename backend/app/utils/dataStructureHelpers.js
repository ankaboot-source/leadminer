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

/**
 * It checks if an email object exists in an array of email objects
 * @param  {array{object}} EmailsMessagesBatch - emails objects batch
 * @param  {object} emailObject - email object to check existence in EmailsMessagesBatch
 * @returns A boolean value.
 */
function checkEmailObjectExistenceInBatch(EmailsMessagesBatch, emailObject) {
  return EmailsMessagesBatch.some((element) => {
    return element.address === emailObject.address;
  });
}

/**
 * It takes an array of objects and an object as arguments and updates the array of objects with the
 * object
 * @param  {array{object}} EmailsMessagesBatch - emails objects batch
 * @param  {object} emailObject - email object
 */
function updateTemporaryBatch(temporaryEmailsObjects, emailObject) {
  for (const i in temporaryEmailsObjects) {
    /* istanbul ignore else */
    if (
      emailObject.address == temporaryEmailsObjects[i].address &&
      !temporaryEmailsObjects[i].messageId.includes(emailObject.messageId[0])
    ) {
      temporaryEmailsObjects[i].messageId.push(...emailObject.messageId);

      Object.keys(temporaryEmailsObjects[i].fields).includes(
        Object.keys(emailObject.fields)[0]
      )
        ? (temporaryEmailsObjects[i].fields[
            Object.keys(emailObject.fields)[0]
          ] += emailObject.fields[Object.keys(emailObject.fields)[0]])
        : (temporaryEmailsObjects[i].fields[
            Object.keys(emailObject.fields)[0]
          ] = emailObject.fields[Object.keys(emailObject.fields)[0]]);
    } else {
      continue;
    }
  }
}

/**
 * It takes two arrays of objects, and merges them into one array of objects
 * @param {array{object}} EmailsMessagesBatch - This is the batch of emails that we are going to merge with the new
 * batch of emails.
 * @param {object} emailsObjects - an array of objects that contain the email information from the body of the
 * email.
 * @returns An array of objects.
 */
function mergeEmailsObjectsFromHeaderAndBodyToBatch(
  EmailsMessagesBatch,
  emailsObjects
) {
  let temporaryEmailsObjects = EmailsMessagesBatch;
  emailsObjects.map((emailObject) => {
    if (checkEmailObjectExistenceInBatch(temporaryEmailsObjects, emailObject)) {
      updateTemporaryBatch(temporaryEmailsObjects, emailObject);
    } else {
      temporaryEmailsObjects.push(emailObject);
    }
  });
  return temporaryEmailsObjects;
}

module.exports = {
  createReadableTreeObjectFromImapTree,
  addPathPerFolder,
  addChildrenTotalForParentFiles,
  mergeEmailsObjectsFromHeaderAndBodyToBatch,
};
