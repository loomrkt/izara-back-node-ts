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
const database_1 = require("../../utils/database");
const firebase_1 = require("../../utils/firebase");
const app_1 = require("firebase/app");
const storage_1 = require("firebase/storage");
const archiver_1 = __importDefault(require("archiver"));
const stream_1 = require("stream");
const crypto = __importStar(require("crypto"));
const server_1 = require("../../server");
(0, app_1.initializeApp)(firebase_1.firebaseConfig);
const storage = (0, storage_1.getStorage)();
// Get files for current user
const getFiles = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Récupérer les fichiers de l'utilisateur
        const { data: files, error } = yield database_1.supabase
            .from("files")
            .select("*")
            .eq("user_id", req.user.id);
        if (error) {
            throw error;
        }
        // Renvoyer les fichiers
        res.status(200).json(files);
        return;
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
        return;
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
        // Ici, TypeScript sait que req.file n'est plus undefined
        const { size } = req.file;
        const socketId = req.body.socketId;
        const dateTime = giveCurrentDateTime();
        const passThrough = new stream_1.PassThrough();
        const archive = (0, archiver_1.default)("zip", { zlib: { level: 9 } });
        // Gestionnaire d'événements de compression
        archive.on("warning", (error) => {
            console.warn("Avertissement lors de la compression :", error);
        });
        archive.on("error", (error) => {
            console.error("Erreur lors de la compression :", error);
            res.status(500).json({ message: "Internal server error" });
        });
        archive.on("end", () => __awaiter(void 0, void 0, void 0, function* () {
            console.log("Compression terminée !");
            server_1.io.to(socketId).emit("compressProgress", { progress: 100 });
        }));
        archive.pipe(passThrough);
        archive.append(req.file.buffer, { name: req.file.originalname });
        archive.finalize();
        const storageRef = (0, storage_1.ref)(storage, `files/${titre + dateTime}.zip`);
        const metadata = { contentType: "application/zip" };
        const chunks = [];
        let processedsize = 0;
        passThrough.on("data", (chunk) => {
            processedsize += chunk.length;
            const uploadPercent = ((processedsize / size) * 100).toFixed(2);
            server_1.io.to(socketId).emit("compressProgress", {
                progress: Math.floor(Number(uploadPercent)),
            });
            chunks.push(chunk);
        });
        passThrough.on("end", () => {
            const buffer = Buffer.concat(chunks);
            const uploadTask = (0, storage_1.uploadBytesResumable)(storageRef, buffer, metadata);
            // Upload phase with 100% weight
            let lastUploadProgress = 0; //  0% (upload)
            uploadTask.on("state_changed", (snapshot) => {
                const uploadPercent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log("Upload en cours :", uploadPercent);
                const totalProgress = Math.floor(uploadPercent);
                if (totalProgress > lastUploadProgress) {
                    for (let i = lastUploadProgress + 1; i <= totalProgress; i++) {
                        server_1.io.to(socketId).emit("uploadProgress", { progress: i });
                    }
                    lastUploadProgress = totalProgress;
                }
            }, (error) => {
                console.error("Erreur d'upload :", error);
            }, () => __awaiter(void 0, void 0, void 0, function* () {
                const downloadURL = yield (0, storage_1.getDownloadURL)(uploadTask.snapshot.ref);
                console.log("Upload terminé !");
                server_1.io.emit("uploadCompleted");
                const taille = uploadTask.snapshot.bytesTransferred;
                const shortId = generateShortId();
                const expirationDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                const { data: rows, error: insertError } = yield database_1.supabase
                    .from("files")
                    .insert([
                    {
                        titre,
                        file_url: downloadURL,
                        expiration_date: expirationDate,
                        user_id: userId,
                        taille,
                        short_id: shortId,
                    },
                ])
                    .select();
                if (insertError)
                    throw insertError;
                res.status(201).json(rows[0]);
            }));
        });
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
        const { data: file, error: selectError } = yield database_1.supabase
            .from("files")
            .select("*")
            .eq("id", id)
            .eq("user_id", userId)
            .single(); // Récupère un seul fichier
        if (selectError || !file) {
            res.status(404).json({
                message: "Fichier non trouvé ou non autorisé",
            });
            return;
        }
        // Récupérer l'URL du fichier
        const fileUrl = file.file_url;
        // Supprimer le fichier du stockage firebase
        const fileRef = (0, storage_1.ref)(storage, fileUrl); // Utilisez l'URL ou une référence spécifique au fichier
        yield (0, storage_1.deleteObject)(fileRef);
        // Supprimer le fichier de la base de données
        const { error: deleteDbError } = yield database_1.supabase
            .from("files")
            .delete()
            .eq("id", id)
            .eq("user_id", userId);
        if (deleteDbError) {
            res.status(500).json({
                message: "Erreur lors de la suppression du fichier de la base de données",
            });
            return;
        }
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
        const { data: files, error: selectError } = yield database_1.supabase
            .from("files")
            .select("*")
            .lt("expiration_date", new Date()); // Sélectionner les fichiers dont la date d'expiration est passée
        if (selectError) {
            console.error(selectError);
            return;
        }
        if (files.length > 0) {
            for (const file of files) {
                // Récupérer l'URL du fichier
                const fileUrl = file.file_url;
                // Supprimer le fichier du stockage Supabase
                const { error: deleteStorageError } = yield database_1.supabase.storage
                    .from("files") // Assurez-vous d'utiliser le bon nom du bucket
                    .remove([fileUrl]);
                if (deleteStorageError) {
                    console.error(`Erreur lors de la suppression du fichier ${file.titre} du stockage :`, deleteStorageError);
                    continue; // Passer au fichier suivant en cas d'erreur
                }
                // Supprimer le fichier de la base de données
                const { error: deleteDbError } = yield database_1.supabase
                    .from("files")
                    .delete()
                    .eq("id", file.id);
                if (deleteDbError) {
                    console.error(`Erreur lors de la suppression du fichier ${file.titre} de la base de données :`, deleteDbError);
                    continue; // Passer au fichier suivant en cas d'erreur
                }
                console.log(`Fichier supprimé : ${file.titre}`);
            }
        }
    }
    catch (error) {
        console.error("Erreur lors de la suppression des fichiers expirés :", error);
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
        // Rechercher l'URL dans la base de données
        const { data: urlData, error: selectError } = yield database_1.supabase
            .from("url")
            .select("*")
            .eq("short_id", hash)
            .single(); // Récupère un seul enregistrement
        if (selectError || !urlData) {
            res.status(404).json({ message: "URL non trouvée" });
            return;
        }
        // Rediriger vers l'URL originale
        res.redirect(urlData.original_url);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.unshorteen = unshorteen;
