import { Router } from 'express';
import streamProgress from '../controllers/stream.controller';

const router = Router();

router.get('/mine/:userid/:id/progress/', streamProgress);

export default router;
