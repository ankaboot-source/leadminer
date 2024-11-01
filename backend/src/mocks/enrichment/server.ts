import express, { json, urlencoded } from 'express';
import {
  coloredLog,
  colors,
  PROXYCURL_API_TOKEN,
  SERVER_PORT,
  THEDIG_API_TOKEN,
  VOILANORBERT_API_TOKEN,
  VOILANORBERT_USERNAME
} from './config';

import voilanorbertRoutes from './endpoints/voilanorbert';
import proxycurlRoutes from './endpoints/proxycurl';
import thedigRoutes from './endpoints/thedig';

const app = express();

app.use(json({ limit: '5mb' }));
app.use(urlencoded({ limit: '5mb', extended: true }));

app.use('/voilanorbert', voilanorbertRoutes);
app.use('/proxycurl', proxycurlRoutes);
app.use('/thedig', thedigRoutes);

app.listen(SERVER_PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `Started mock servers for local development.
    ${coloredLog(
      colors.cyan,
      '- Voilanorbert:'
    )} http://127.0.0.1:${SERVER_PORT}/voilanorbert
        ${coloredLog(colors.cyan, '- Api key:')} ${VOILANORBERT_API_TOKEN}
        ${coloredLog(colors.cyan, '- Username:')} ${VOILANORBERT_USERNAME}
    ${coloredLog(
      colors.cyan,
      '- Proxycurl:'
    )} http://127.0.0.1:${SERVER_PORT}/proxycurl
        ${coloredLog(colors.cyan, '- Api key:')} ${PROXYCURL_API_TOKEN}
    ${coloredLog(
      colors.cyan,
      '- Thedig:'
    )} http://127.0.0.1:${SERVER_PORT}/thedig
        ${coloredLog(colors.cyan, '- Api key:')} ${THEDIG_API_TOKEN}
  `
  );
});
