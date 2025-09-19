// @ts-expect-error missing types definition file
import objectScan from 'object-scan';
import type { TreeSelectionKeys } from 'primevue/tree';

export interface BoxNode {
  key: string;
  label: string;
  total: number;
  children?: BoxNode[];
}

export const EMAIL_EXCLUDED_FOLDERS = [
  'mailspring',
  'outbox',
  'drafts',
  'junk',
  'trash',
  '\\drafts',
  '\\junk',
  '\\trash',
];

/**
 * Gets all selected folders
 * @param boxes - The array of folder names to filter
 * @returns The filtered array of boxes
 */
function getAllFolders(boxes: BoxNode[]) {
  const folders: TreeSelectionKeys = [];
  objectScan(['**.key'], {
    joined: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filterFn: ({ parent }: any) => {
      const { key } = parent;
      folders[key] = {
        checked: true,
        partialChecked: false,
        isNoSelect: Boolean(parent.attribs?.includes('\\Noselect')),
      };
    },
  })(boxes);
  return folders;
}

/**
 * Filters out default selected folders from the input boxes based on email service
 * @param boxes - The array of folder names to filter
 * @returns The filtered array of boxes
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getFilteredFolders(boxes: BoxNode[]) {
  const filteredFolders: TreeSelectionKeys = [];
  let foundAllMailKey: string | null = null;

  objectScan(['**.key'], {
    joined: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filterFn: ({ parent }: any) => {
      const { key, attribs } = parent;
      const folder = key.split('/');
      const folderName = folder.pop();
      const folderParent = folder.pop();
      const isAllMail = attribs?.includes('\\All');

      if (foundAllMailKey && !isAllMail) return;

      const isExcluded = [...(attribs ?? []), folderName, folderParent]
        .filter(Boolean)
        .map((name) => name.toLowerCase())
        .some((name) => EMAIL_EXCLUDED_FOLDERS.includes(name));

      if (isExcluded) return;

      // Format to be like PrimeVue's TreeSelectionKeys
      const checked = attribs && !attribs.includes('\\HasChildren');
      const partialChecked = !checked;
      const isNoSelect = Boolean(attribs?.includes('\\Noselect'));

      if (isAllMail && !isNoSelect) {
        Object.keys(filteredFolders).forEach((k) => delete filteredFolders[k]);
        // Add All Mail as the only selected folder
        filteredFolders[key] = {
          checked: true,
          partialChecked: false,
          isNoSelect,
        };
        foundAllMailKey = key;
      } else {
        filteredFolders[key] = {
          checked,
          partialChecked,
          isNoSelect,
        };
      }
    },
  })(boxes);

  return filteredFolders;
}

/**
 * Gets default selected folders from the input boxes based on email service
 * @param boxes - The array of folder names to filter
 * @returns The filtered array of boxes
 */
export function getDefaultSelectedFolders(boxes: BoxNode[]) {
  const defaultFolders = getFilteredFolders(boxes);
  return defaultFolders;
}
