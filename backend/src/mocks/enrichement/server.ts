import express, { json, urlencoded } from 'express';
import {
  coloredLog,
  colors,
  SERVER_PORT,
  VOILANORBERT_API_TOKEN,
  VOILANORBERT_USERNAME
} from './config';

import voilanorbertRoutes from './endpoints/voilanorbert';

const app = express();

app.use(json({ limit: '5mb' }));
app.use(urlencoded({ limit: '5mb', extended: true }));

app.use('/voilanorbert', voilanorbertRoutes);

app.listen(SERVER_PORT, () => {
  // @ts-ignore
  console.log(
    `Started mocks server for local development.
    ${coloredLog(colors.cyan, 'Server:')} http://127.0.0.1:${SERVER_PORT}
    ${coloredLog(
      colors.cyan,
      'Voilanorbert:'
    )} http://127.0.0.1:${SERVER_PORT}/voilanorbert
        ${coloredLog(colors.cyan, 'Api key:')} ${VOILANORBERT_API_TOKEN}
        ${coloredLog(colors.cyan, 'Username:')} ${VOILANORBERT_USERNAME}
  `
  );
});
