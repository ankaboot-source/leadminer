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

function fetchRemoteFile(remotePath, saveLocation) {
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
