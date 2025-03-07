"use strict";
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
exports.deleteFile = exports.createFile = exports.getFiles = void 0;
const database_1 = __importDefault(require("../../utils/database"));
const firebase_1 = require("../../utils/firebase");
const app_1 = require("firebase/app");
const storage_1 = require("firebase/storage");
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
            res.status(400).json({ error: 'Aucun fichier fourni.' });
            return;
        }
        const dateTime = giveCurrentDateTime();
        const storageRef = (0, storage_1.ref)(storage, `files/${req.file.originalname + "       " + dateTime}`);
        // Create file metadata including the content type
        const metadata = {
            contentType: req.file.mimetype,
        };
        // Upload the file in the bucket storage
        const snapshot = yield (0, storage_1.uploadBytesResumable)(storageRef, req.file.buffer, metadata);
        //by using uploadBytesResumable we can control the progress of uploading like pause, resume, cancel
        // Grab the public url
        const downloadURL = yield (0, storage_1.getDownloadURL)(snapshot.ref);
        const { rows } = yield database_1.default.query(`INSERT INTO files 
            (titre, file_url, expiration_date, user_id) 
            VALUES ($1, $2, NOW() + INTERVAL '7 days', $3)
            RETURNING *`, [titre, downloadURL, userId]);
        res.status(201).json(rows[0]);
        return;
    }
    catch (error) {
        console.error(error);
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
                message: "Fichier non trouvé ou non autorisé"
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
        yield database_1.default.query("DELETE FROM files WHERE id = $1 AND user_id = $2", [id, userId]);
        res.status(200).json({
            message: "Fichier supprimé avec succès"
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
    const date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
    const time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    const dateTime = date + ' ' + time;
    return dateTime;
};
