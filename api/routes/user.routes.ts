import { Router } from 'express';
import { getUserProfile } from '../controllers/user.controller';
import { verifyAccessToken } from '../../middlewares/auth.middleware';

const router = Router();

router.get('/', verifyAccessToken, getUserProfile);

export default router;
