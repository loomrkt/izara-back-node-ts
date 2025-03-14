"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleUploadErrors = exports.upload = void 0;
const multer_1 = __importStar(require("multer"));
const invalidMimes = [
    "application/x-msdownload", // Exécutables Windows
    "application/x-shockwave-flash", // Fichiers Flash
    "application/x-msdos-program",
    "application/x-dmg", // Images disque Mac
    "application/vnd.android.package-archive", // APK Android
];
exports.upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
    fileFilter: (req, file, cb) => {
        if (invalidMimes.includes(file.mimetype)) {
            cb(new Error(`Type de fichier interdit : ${file.mimetype}`));
        }
        else {
            cb(null, true);
        }
    },
});
// Middleware de gestion d'erreurs typé
const handleUploadErrors = (err, req, res, next) => {
    if (err instanceof multer_1.MulterError) {
        res.status(400).json({
            success: false,
            error: err.code === "LIMIT_FILE_SIZE"
                ? "Le fichier dépasse la taille maximale autorisée (500MB)"
                : "Erreur lors du téléchargement du fichier",
        });
        return;
    }
    if (err instanceof Error) {
        res.status(403).json({
            success: false,
            error: err.message,
        });
        return;
    }
    res.status(500).json({
        success: false,
        error: "Erreur interne du serveur",
    });
};
exports.handleUploadErrors = handleUploadErrors;
