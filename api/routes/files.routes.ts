import express from "express";
import { handleUploadErrors, upload } from "../../utils/multer";
import {
  getFiles,
  createFile,
  deleteFile,
  unshorteen,
} from "../controllers/files.controller";
import { verifyAccessToken } from "../../middlewares/auth.middleware";

const router = express.Router();

router.get("/", verifyAccessToken, getFiles);
router.get("/:hash", unshorteen);
router.post(
  "/",
  verifyAccessToken,
  upload.single("file"),
  createFile,
  handleUploadErrors
);
router.delete("/:id", verifyAccessToken, deleteFile);
export default router;