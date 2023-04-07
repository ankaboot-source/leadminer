const fs = require('fs');
const path = require('path');
const https = require('https');

const DISPOSABLE_EMAIL_PROVIDERS_SAVE_LOCATION = path.join(
  __dirname,
  'app/utils/Disposable.json'
);
const DISPOSABLE_EMAIL_PROVIDERS_REMOTE_PATH =
  'https://raw.githubusercontent.com/ankaboot-source/open-data/main/disposable-email-domains.json';

const PUBLIC_EMAIL_PROVIDERS_REMOTE_PATH =
  'https://raw.githubusercontent.com/ankaboot-source/open-data/main/public-email-providers.json';
const PUBLIC_EMAIL_PROVIDERS_SAVE_LOCATION = path.join(
  __dirname,
  'app/utils/FreeProviders.json'
);

/**
 * Downloads a file from a remote location and saves it to a specified location on the local machine.
 * @param {string} remotePath - The URL of the remote file to download.
 * @param {string} saveLocation - The saving location of the file.
 * @returns {Promise} - A promise that resolves when the file is successfully downloaded and saved, or rejects if an error occurs during the process.
 */
function fetchRemoteFile(remotePath, saveLocation) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const file = fs.createWriteStream(saveLocation);

  return new Promise((resolve, reject) => {
    https.get(remotePath, (response) => {
      const stream = response.pipe(file);

      stream.on('finish', () => {
        resolve();
      });

      stream.on('error', (error) => {
        reject(new Error(`Failed retrieving file from remote: ${error}`));
      });
    });
  });
}

(async () => {
  await Promise.all([
    fetchRemoteFile(
      DISPOSABLE_EMAIL_PROVIDERS_REMOTE_PATH,
      DISPOSABLE_EMAIL_PROVIDERS_SAVE_LOCATION
    ),
    fetchRemoteFile(
      PUBLIC_EMAIL_PROVIDERS_REMOTE_PATH,
      PUBLIC_EMAIL_PROVIDERS_SAVE_LOCATION
    )
  ]);
})();
