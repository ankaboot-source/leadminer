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

const EXCLUDED_FOLDERS_FROM_DEFAULT = [
  'mailspring',
  'outbox',
  'drafts',
  'junk',
  'trash',
  '\\drafts',
  '\\junk',
  '\\trash',
];

const EXCLUDED_ATTRIBS_FROM_SELECTION = ['\\Noselect'];

/**
 * Gets default selected folders from the input boxes based on email service
 * @param boxes - The array of folder names to filter
 * @returns The filtered array of boxes and a set of excluded boxes keys
 */
export function getDefaultAndExcludedFolders(boxes: BoxNode[]) {
  const defaultFolders: TreeSelectionKeys = {};
  let foundAllMailKey: string | null = null;
  const excludedKeys = new Set<string>();

  objectScan(['**.key'], {
    joined: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filterFn: ({ parent }: any) => {
      const { key, attribs } = parent;
      const folder = key.split('/');
      const folderName = folder.pop();
      const folderParent = folder.pop();
      const isAllMail = attribs?.includes('\\All');

      if (
        attribs &&
        EXCLUDED_ATTRIBS_FROM_SELECTION.some((attrib) =>
          attribs.includes(attrib),
        )
      ) {
        excludedKeys.add(key);
      }

      if (foundAllMailKey && !isAllMail) return;

      const isExcluded = [...(attribs ?? []), folderName, folderParent]
        .filter(Boolean)
        .map((name) => name.toLowerCase())
        .some((name) => EXCLUDED_FOLDERS_FROM_DEFAULT.includes(name));

      if (isExcluded) return;

      const checked = attribs && !attribs.includes('\\HasChildren');
      const partialChecked = !checked;
      const isNoSelect = Boolean(attribs?.includes('\\Noselect')) || undefined;

      if (isAllMail && !isNoSelect) {
        // Clear previous selections
        // skipcq: JS-0320
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        Object.keys(defaultFolders).forEach((k) => delete defaultFolders[k]);
        // Add All Mail as checked
        defaultFolders[key] = {
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
          if (parentKey in defaultFolders) continue;
          defaultFolders[parentKey] = {
            checked: false,
            partialChecked: true,
          };
        }
      } else {
        defaultFolders[key] = {
          checked,
          partialChecked,
        };
      }
    },
  })(boxes);

  return { defaultFolders, excludedKeys };
}
