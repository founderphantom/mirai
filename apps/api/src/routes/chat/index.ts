import { Router } from 'express';
import conversationsRouter from './conversations.route';
import messagesRouter from './messages.route';

const router = Router();

// Mount sub-routers
router.use('/conversations', conversationsRouter);
router.use('/messages', messagesRouter);

export default router;