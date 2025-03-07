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
router.use(auth_middleware_1.verifyAccessToken);
router.get('/', files_controller_1.getFiles);
router.post('/', multer_1.upload.single('file'), files_controller_1.createFile);
router.delete('/:id', files_controller_1.deleteFile);
exports.default = router;
