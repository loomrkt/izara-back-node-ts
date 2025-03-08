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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.unshorteen = exports.deleteFile = exports.createFile = exports.getFiles = void 0;
const database_1 = __importDefault(require("../../utils/database"));
const firebase_1 = require("../../utils/firebase");
const app_1 = require("firebase/app");
const storage_1 = require("firebase/storage");
const archiver_1 = __importDefault(require("archiver"));
const stream_1 = require("stream");
const crypto = __importStar(require("crypto"));
(0, app_1.initializeApp)(firebase_1.firebaseConfig);
const storage = (0, storage_1.getStorage)();
// Get files for current user
const getFiles = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { rows } = yield database_1.default.query("SELECT * FROM files WHERE user_id = $1", [req.user.id]);
        res.status(200).json(rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.getFiles = getFiles;
// Create file with user association
const createFile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { titre } = req.body;
        const userId = req.user.id;
        if (!req.file) {
            res.status(400).json({ error: "Aucun fichier fourni." });
            return;
        }
        const dateTime = giveCurrentDateTime();
        // Créer un flux pour l'archive
        const pass = new stream_1.PassThrough();
        const archive = (0, archiver_1.default)("zip", { zlib: { level: 9 } });
        // Lorsque l'archive est terminée, fermez le flux
        archive.on("end", () => {
            console.log("Archive complète");
        });
        // Pipe l'archive vers le flux
        archive.pipe(pass);
        archive.append(req.file.buffer, { name: req.file.originalname });
        archive.finalize();
        const storageRef = (0, storage_1.ref)(storage, `files/${titre + dateTime}.zip`);
        // Créer les métadonnées du fichier
        const metadata = {
            contentType: "application/zip", // Changez le type de contenu si vous utilisez .rar
        };
        // Télécharger le fichier dans le stockage
        const chunks = [];
        pass.on("data", (chunk) => chunks.push(chunk));
        pass.on("end", () => __awaiter(void 0, void 0, void 0, function* () {
            const buffer = Buffer.concat(chunks);
            const snapshot = yield (0, storage_1.uploadBytesResumable)(storageRef, buffer, metadata);
            const downloadURL = yield (0, storage_1.getDownloadURL)(snapshot.ref);
            const taille = snapshot.bytesTransferred;
            const shortId = generateShortId();
            const { rows } = yield database_1.default.query(`INSERT INTO files 
              (titre, file_url, expiration_date, user_id, taille, short_id) 
              VALUES ($1, $2, NOW() + INTERVAL '7 days', $3, $4, $5)
              RETURNING *`, [titre, downloadURL, userId, taille, shortId]);
            console.log(downloadURL);
            const url = `${process.env.FRONTEND_URL}/download?shortId=${encodeURIComponent(rows[0].shortId)}&titre=${encodeURIComponent(rows[0].titre)}&taille=${encodeURIComponent(rows[0].taille)}&expiration_date=${encodeURIComponent(rows[0].expiration_date)}&file_url=${encodeURIComponent(rows[0].file_url)}`;
            console.log(url);
            yield database_1.default.query("INSERT INTO url (short_id, original_url) VALUES ($1, $2)", [shortId, url]);
            res.status(201).json(rows[0]);
        }));
    }
    catch (error) {
        console.log(`Erreur lors de la création du fichier : ${error}`);
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.createFile = createFile;
// Delete file with ownership check
const deleteFile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        // Vérifier l'appartenance avant suppression
        const { rows } = yield database_1.default.query("SELECT * FROM files WHERE id = $1 AND user_id = $2", [id, userId]);
        if (rows.length === 0) {
            res.status(404).json({
                message: "Fichier non trouvé ou non autorisé",
            });
            return;
        }
        // Récupérer le nom du fichier ou l'URL dans la base de données
        const fileUrl = rows[0].file_url;
        // Récupérer la référence du fichier dans Firebase Storage
        const fileRef = (0, storage_1.ref)(storage, fileUrl); // Utilisez l'URL ou une référence spécifique au fichier
        // Supprimer le fichier de Firebase Storage
        yield (0, storage_1.deleteObject)(fileRef);
        // Supprimer le fichier de la base de données
        yield database_1.default.query("DELETE FROM files WHERE id = $1 AND user_id = $2", [
            id,
            userId,
        ]);
        res.status(200).json({
            message: "Fichier supprimé avec succès",
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.deleteFile = deleteFile;
// Tâche périodique pour vérifier et supprimer les fichiers expirés
const deleteExpiredFiles = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Rechercher les fichiers expirés
        const { rows } = yield database_1.default.query("SELECT * FROM files WHERE expiration_date < NOW()");
        if (rows.length > 0) {
            for (const file of rows) {
                // Supprimer le fichier de Cloudinary
                // Récupérer le nom du fichier ou l'URL dans la base de données
                const fileUrl = file.file_url;
                // Récupérer la référence du fichier dans Firebase Storage
                const fileRef = (0, storage_1.ref)(storage, fileUrl); // Utilisez l'URL ou une référence spécifique au fichier
                // Supprimer le fichier de Firebase Storage
                yield (0, storage_1.deleteObject)(fileRef);
                // Supprimer le fichier de la base de données
                yield database_1.default.query("DELETE FROM files WHERE id = $1", [file.id]);
                console.log(`Fichier supprimé : ${file.titre}`);
            }
        }
    }
    catch (error) {
        console.error("Erreur lors de la suppression des fichiers expirés : ", error);
    }
});
// Exécuter la tâche toutes les 24 heures
setInterval(deleteExpiredFiles, 24 * 60 * 60 * 1000);
const giveCurrentDateTime = () => {
    const today = new Date();
    const date = today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate();
    const time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    const dateTime = date + " " + time;
    return dateTime;
};
function generateShortId(length = 6) {
    return crypto
        .randomBytes(Math.ceil(length / 2))
        .toString("hex")
        .slice(0, length);
}
// Validation d'URL renforcée
const isValidUrl = (url) => {
    try {
        new URL(url);
        return /^https?:/.test(url);
    }
    catch (_a) {
        return false;
    }
};
const unshorteen = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { hash } = req.params;
        if (!hash) {
            res.status(400).json({ message: "URL invalide" });
            return;
        }
        const { rows } = yield database_1.default.query("SELECT * FROM url WHERE short_id = $1", [hash]);
        if (rows.length === 0) {
            res.status(404).json({ message: "URL non trouvée" });
            return;
        }
        res.redirect(rows[0].original_url);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.unshorteen = unshorteen;
