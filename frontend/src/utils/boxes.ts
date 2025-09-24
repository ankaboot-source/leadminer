// @ts-expect-error missing types definition file
import objectScan from 'object-scan';
import type { TreeSelectionKeys } from 'primevue/tree';

export interface BoxNode {
  key: string;
  label: string;
  total: number;
  children?: BoxNode[];
  attribs?: string[];
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
 * Gets default selected folders from the input boxes based on email service
 * @param boxes - The array of folder names to filter
 * @returns The filtered array of boxes
 */
export function getDefaultSelectedFolders(boxes: BoxNode[]) {
  const filteredFolders: TreeSelectionKeys = {};
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

      const checked = attribs && !attribs.includes('\\HasChildren');
      const partialChecked = !checked;
      const isNoSelect = Boolean(attribs?.includes('\\Noselect')) || undefined;

      if (isAllMail && !isNoSelect) {
        // Clear previous selections
        // skipcq: JS-0320
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        Object.keys(filteredFolders).forEach((k) => delete filteredFolders[k]);
        // Add All Mail as checked
        filteredFolders[key] = {
          checked: true,
          partialChecked: false,
          isNoSelect,
        };
        foundAllMailKey = key;

        // Also mark parent folders as partially checked
        const pathParts = key.split('/');
        while (pathParts.length > 0) {
          pathParts.pop(); // remove current
          const parentKey = pathParts.join('/');
          if (parentKey in filteredFolders) continue;
          filteredFolders[parentKey] = {
            checked: false,
            partialChecked: true,
          };
        }
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
