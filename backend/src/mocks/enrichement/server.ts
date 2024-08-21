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
  // eslint-disable-next-line no-console
  console.log(
    `Started mock servers for local development.
    ${coloredLog(
      colors.cyan,
      '- Voilanorbert:'
    )} http://127.0.0.1:${SERVER_PORT}/voilanorbert
        ${coloredLog(colors.cyan, '- Api key:')} ${VOILANORBERT_API_TOKEN}
        ${coloredLog(colors.cyan, '- Username:')} ${VOILANORBERT_USERNAME}
  `
  );
});
