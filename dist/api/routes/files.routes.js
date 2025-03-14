"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = require("../../utils/multer");
const files_controller_1 = require("../controllers/files.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const router = express_1.default.Router();
router.get("/", auth_middleware_1.verifyAccessToken, files_controller_1.getFiles);
router.get("/:hash", files_controller_1.unshorteen);
router.post("/", auth_middleware_1.verifyAccessToken, multer_1.upload.single("file"), files_controller_1.createFile, multer_1.handleUploadErrors);
router.delete("/:id", auth_middleware_1.verifyAccessToken, files_controller_1.deleteFile);
exports.default = router;
