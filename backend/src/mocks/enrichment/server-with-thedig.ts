import express, { json, urlencoded } from 'express';
import {
  SERVER_PORT
} from './config';

import voilanorbertRoutes from './endpoints/voilanorbert';
import enrichlayerRoutes from './endpoints/enrichlayer';
import thedigRoutes from './endpoints/thedig';

const app = express();

app.use(json({ limit: '5mb' }));
app.use(urlencoded({ limit: '5mb', extended: true }));

// Original mounts (kept for backwards compatibility)
app.use('/voilanorbert', voilanorbertRoutes);
app.use('/enrichlayer', enrichlayerRoutes);
// TheDig engine mock at /thedig
app.use('/thedig', thedigRoutes);

// ALSO mount the same routes at the engine's URL-construction path
// (the engine uses `new URL("/api/...", baseUrl)` which drops the
// path prefix from baseUrl, so routes need to be reachable at /api/...)
app.use('/', enrichlayerRoutes);
app.use('/', thedigRoutes);

app.listen(SERVER_PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `Started mock servers for local development on port ${SERVER_PORT}`
  );
});
