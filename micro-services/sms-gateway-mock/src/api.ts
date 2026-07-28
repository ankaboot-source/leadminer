import { Router } from 'express';
import healthRoute from './routes/health';
import configRoute from './routes/config';
import { getMessagesRoute, deleteMessagesRoute } from './routes/messages';
import { sendSmsRoute } from './routes/sendSms';

const apiRoutes = Router();

apiRoutes.get('/health', healthRoute);
apiRoutes.post('/config', configRoute);
apiRoutes.get('/messages', getMessagesRoute);
apiRoutes.delete('/messages', deleteMessagesRoute);
apiRoutes.post('/:provider/send-sms', sendSmsRoute);
apiRoutes.post('/smsgate/3rdparty/v1/messages', (req, res) => {
  (req.params as { provider: string }).provider = 'smsgate';
  return sendSmsRoute(req, res);
});

export default apiRoutes;
