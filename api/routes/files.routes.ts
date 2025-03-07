import express from "express";
import { upload } from "../../utils/multer";
import { getFiles, createFile,deleteFile } from "../controllers/files.controller";
import { verifyAccessToken } from '../../middlewares/auth.middleware';

const router = express.Router();

router.use(verifyAccessToken);
router.get('/', getFiles);
router.post('/',upload.single('file'), createFile);
router.delete('/:id', deleteFile);

export default router;