import { GMAIL_EXCLUDED_FOLDERS, OUTLOOK_EXCLUDED_FOLDERS } from "./constants";
import objectScan from "object-scan";

/**
 * Filters out default selected folders from the input boxes based on email service
 * @param {Array} boxes - The array of folder names to filter
 * @returns {Array} - The filtered array of boxes
 */
export function filterDefaultSelectedFolders(boxes) {
  const email = boxes[0].label;
  const excludedFolders = email.includes("gmail")
    ? GMAIL_EXCLUDED_FOLDERS
    : OUTLOOK_EXCLUDED_FOLDERS;

  const filteredBoxes = [];

  objectScan(["**.path"], {
    joined: true,
    filterFn: ({ value }) => {
      const folderName = value.slice(value.lastIndexOf("/") + 1).toLowerCase();
      if (!excludedFolders.includes(folderName)) {
        filteredBoxes.push(value);
      }
    },
  })(boxes);

  return filteredBoxes;
}
