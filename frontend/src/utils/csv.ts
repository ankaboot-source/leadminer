function clean(link: HTMLAnchorElement) {
  setTimeout(() => {
    window.URL.revokeObjectURL(link.href);
  }, 10000);
}

/**
 * Saves the CSV data as a downloadable file.
 * @param {Blob} data - The CSV data as a Blob object.
 * @param {string} filename - The filename for the downloaded CSV file.
 */
export function saveCSVFile(data: Blob, filename: string) {
  const blob: Blob = new Blob([data], { type: 'text/csv' });
  const link: HTMLAnchorElement = document.createElement('a');

  link.href = window.URL.createObjectURL(blob);
  link.setAttribute('download', filename);

  // Check for "download" attribute support;
  // If not supported, open this in new window
  if (typeof link.download === 'undefined') {
    link.setAttribute('target', '_blank');
  }

  link.classList.add('hidden');
  link.style.position = 'fixed'; // avoid scrolling to bottom
  document.body.appendChild(link);

  document.body.appendChild(link);

  try {
    link.click();
    clean(link);
  } catch (err) {
    clean(link);
    throw err;
  }
}
