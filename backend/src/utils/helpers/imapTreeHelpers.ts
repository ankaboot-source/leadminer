import Connection, { MailBoxes } from 'imap';
import { FlatTree } from '../../services/imap/types';
import logger from '../logger';

/**
 * createFlatTreeFromImap - creates a readable flat array from tree object
 * @param imapTree - native imap tree
 */
export function createFlatTreeFromImap(
  imapTree: MailBoxes,
  currentParent?: FlatTree
) {
  const readableTree: FlatTree[] = [];

  Object.entries(imapTree).forEach(([folderLabel, folderDetails]) => {
    let { delimiter } = folderDetails;

    if (!delimiter) {
      delimiter = '/';
      logger.debug(
        `[createFlatTreeFromImap]: Folder separator was not provided. Defaulting to "${delimiter}".`,
        folderDetails
      );
    }

    const folder = {
      label: folderLabel,
      key: currentParent
        ? `${currentParent.key}${delimiter}${folderLabel}`
        : folderLabel,
      parent: currentParent,
      attribs: folderDetails.attribs
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
 * Gets the total number of messages per folder
 * @param folders - flat array of objects.
 * @param imapConnection - An IMAP connection.
 */
export function addTotalPerFolder(
  folders: FlatTree[],
  imapConnection: Connection
) {
  const promises = folders.map(
    (folder) =>
      new Promise((resolve, reject) => {
        imapConnection.status(folder.key, (err, box) => {
          if (err) {
            reject(err);
          }
          if (box) {
            // eslint-disable-next-line no-param-reassign
            folder.total = box.messages.total;
            // eslint-disable-next-line no-param-reassign
            folder.cumulativeTotal = box.messages.total;
          } else {
            // eslint-disable-next-line no-param-reassign
            folder.total = 0;
            // eslint-disable-next-line no-param-reassign
            folder.cumulativeTotal = 0;
          }
          resolve(true);
        });
      })
  );
  return Promise.allSettled(promises);
}

/**
 * @param flatTree - A flat array of objects to build a tree.
 * @param userEmail - The email address of the user you want to get the data for.
 */

export function buildFinalTree(flatTree: FlatTree[], userEmail: string) {
  const readableTree = [];
  let totalInEmail = 0;

  for (const box of flatTree) {
    box.key = box.key.toString();

    if (box.parent) {
      if (box.parent.children) {
        box.parent.children.push(box);
      } else {
        box.parent.children = [box];
      }
      box.parent.cumulativeTotal! += box.total!;
    } else {
      readableTree.push(box);
    }
    totalInEmail += box.total!;
    delete box.parent;
  }

  return [
    {
      label: userEmail,
      children: [...readableTree],
      total: totalInEmail,
      key: ''
    }
  ];
}
