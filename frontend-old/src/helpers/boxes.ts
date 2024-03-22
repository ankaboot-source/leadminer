// @ts-expect-error missing types definition file
import objectScan from "object-scan";

export interface BoxNode {
  label: string;
  total: number;
  children: BoxNode[];
}

export const EMAIL_EXCLUDED_FOLDERS = [
  "mailspring",
  "outbox",
  "drafts",
  "junk",
  "trash",
  "\\all",
  "\\drafts",
  "\\junk",
  "\\trash",
];

/**
 * Filters out default selected folders from the input boxes based on email service
 * @param boxes - The array of folder names to filter
 * @returns The filtered array of boxes
 */
export function getDefaultSelectedFolders(boxes: string[]) {
  const filteredBoxes: string[] = [];

  objectScan(["**.path"], {
    joined: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filterFn: ({ parent }: any) => {
      const { path, attribs } = parent;
      const folder = path.split("/");
      const folderName = folder.pop();
      const folderParent = folder.pop();

      const isExcluded = [...attribs, folderName, folderParent]
        .filter(Boolean)
        .map((name) => name.toLowerCase())
        .some((name) => EMAIL_EXCLUDED_FOLDERS.includes(name));

      if (!isExcluded) {
        filteredBoxes.push(path);
      }
    },
  })(boxes);

  return filteredBoxes;
}
