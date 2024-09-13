import { createWriteStream } from 'fs';
import { get } from 'https';
import { join } from 'path';

const DISPOSABLE_EMAIL_PROVIDERS_SAVE_LOCATION = join(
  __dirname,
  'utils/Disposable.json'
);
const DISPOSABLE_EMAIL_PROVIDERS_REMOTE_PATH =
  'https://raw.githubusercontent.com/ankaboot-source/email-open-data/main/disposable-email-domains.json';

const PUBLIC_EMAIL_PROVIDERS_REMOTE_PATH =
  'https://raw.githubusercontent.com/ankaboot-source/email-open-data/main/public-email-providers.json';
const PUBLIC_EMAIL_PROVIDERS_SAVE_LOCATION = join(
  __dirname,
  'utils/FreeProviders.json'
);

/**
 * Downloads a file from a remote location and saves it to a specified location on the local machine.
 * @param {string} remotePath - The URL of the remote file to download.
 * @param {string} saveLocation - The saving location of the file.
 * @returns {Promise} - A promise that resolves when the file is successfully downloaded and saved, or rejects if an error occurs during the process.
 */
function fetchRemoteFile(remotePath: string, saveLocation: string) {
  const file = createWriteStream(saveLocation);

  return new Promise((resolve, reject) => {
    get(remotePath, (response) => {
      const stream = response.pipe(file);

      stream.on('finish', () => {
        resolve(true);
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
