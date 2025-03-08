"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
exports.upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(), // Garde le fichier en mémoire
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
    fileFilter: (req, file, cb) => {
        const validMimes = [
            "application/pdf",
            "application/x-zip-compressed",
            "application/zip",
            "application/x-rar-compressed",
            "image/*", // Tous types images
            "video/*", // Tous types vidéos
            "text/plain",
            "application/octet-stream", // Fallback
        ];
        if (validMimes.some(mime => file.mimetype.match(mime))) {
            cb(null, true);
        }
        else {
            cb(new Error(`Type non supporté: ${file.mimetype}`));
        }
    }
});
