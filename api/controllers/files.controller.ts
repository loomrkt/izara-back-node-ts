import { Request, Response } from "express";
import client from "../../utils/database";
import {firebaseConfig} from "../../utils/firebase";
import { initializeApp } from "firebase/app";
import { getStorage, ref, getDownloadURL, uploadBytesResumable , deleteObject } from "firebase/storage";
import archiver from "archiver";
import { PassThrough } from "stream";
import * as crypto from "crypto";
import validUrl from "valid-url";

interface User {
  id: string;
}
initializeApp(firebaseConfig);
const storage = getStorage();

// Get files for current user
export const getFiles = async (req: Request, res: Response) => {
  try {
    const { rows } = await client.query(
      "SELECT * FROM files WHERE user_id = $1",
      [(req.user as User).id]
    );
    res.status(200).json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Create file with user association
export const createFile = async (req: Request, res: Response) => {
  try {
    const { titre } = req.body;
    const userId = (req.user as User).id;

    if (!req.file) {
      res.status(400).json({ error: "Aucun fichier fourni." });
      return;
    }

    const dateTime = giveCurrentDateTime();

    // Créer un flux pour l'archive
    const pass = new PassThrough();
    const archive = archiver("zip", { zlib: { level: 9 } });

    // Lorsque l'archive est terminée, fermez le flux
    archive.on("end", () => {
      console.log("Archive complète");
    });

    // Pipe l'archive vers le flux
    archive.pipe(pass);
    archive.append(req.file.buffer, { name: req.file.originalname });
    archive.finalize();

    const storageRef = ref(storage, `files/${titre + dateTime}.zip`);

    // Créer les métadonnées du fichier
    const metadata = {
      contentType: "application/zip", // Changez le type de contenu si vous utilisez .rar
    };

    // Télécharger le fichier dans le stockage
    const chunks: Buffer[] = [];
    pass.on("data", (chunk) => chunks.push(chunk));
    pass.on("end", async () => {
      const buffer = Buffer.concat(chunks);
      const snapshot = await uploadBytesResumable(storageRef, buffer, metadata);
      const downloadURL = await getDownloadURL(snapshot.ref);
      const taille = snapshot.bytesTransferred;

      const shortId = generateShortId();

      const { rows } = await client.query(
        `INSERT INTO files 
              (titre, file_url, expiration_date, user_id, taille, short_id) 
              VALUES ($1, $2, NOW() + INTERVAL '7 days', $3, $4, $5)
              RETURNING *`,
        [titre, downloadURL, userId, taille, shortId]
      );
      console.log(downloadURL);
      const url = `${
        process.env.FRONTEND_URL
      }/download?shortId=${encodeURIComponent(
        rows[0].shortId
      )}&titre=${encodeURIComponent(rows[0].titre)}&taille=${encodeURIComponent(
        rows[0].taille
      )}&expiration_date=${encodeURIComponent(
        rows[0].expiration_date
      )}&file_url=${encodeURIComponent(rows[0].file_url)}`;
      console.log(url);
      await client.query(
        "INSERT INTO url (short_id, original_url) VALUES ($1, $2)",
        [shortId, url]
      );

      res.status(201).json(rows[0]);
    });
  } catch (error) {
    console.log(`Erreur lors de la création du fichier : ${error}`);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete file with ownership check
export const deleteFile = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req.user as User).id;

    // Vérifier l'appartenance avant suppression
    const { rows } = await client.query(
      "SELECT * FROM files WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    if (rows.length === 0) {
      res.status(404).json({
        message: "Fichier non trouvé ou non autorisé",
      });
      return;
    }

    // Récupérer le nom du fichier ou l'URL dans la base de données
    const fileUrl = rows[0].file_url;

    // Récupérer la référence du fichier dans Firebase Storage
    const fileRef = ref(storage, fileUrl); // Utilisez l'URL ou une référence spécifique au fichier

    // Supprimer le fichier de Firebase Storage
    await deleteObject(fileRef);

    // Supprimer le fichier de la base de données
    await client.query("DELETE FROM files WHERE id = $1 AND user_id = $2", [
      id,
      userId,
    ]);

    res.status(200).json({
      message: "Fichier supprimé avec succès",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Tâche périodique pour vérifier et supprimer les fichiers expirés
const deleteExpiredFiles = async () => {
  try {
    // Rechercher les fichiers expirés
    const { rows } = await client.query(
      "SELECT * FROM files WHERE expiration_date < NOW()"
    );

    if (rows.length > 0) {
      for (const file of rows) {
        // Supprimer le fichier de Cloudinary

        // Récupérer le nom du fichier ou l'URL dans la base de données
        const fileUrl = file.file_url;

        // Récupérer la référence du fichier dans Firebase Storage
        const fileRef = ref(storage, fileUrl); // Utilisez l'URL ou une référence spécifique au fichier

        // Supprimer le fichier de Firebase Storage
        await deleteObject(fileRef);
        // Supprimer le fichier de la base de données
        await client.query("DELETE FROM files WHERE id = $1", [file.id]);

        console.log(`Fichier supprimé : ${file.titre}`);
      }
    }
  } catch (error) {
    console.error(
      "Erreur lors de la suppression des fichiers expirés : ",
      error
    );
  }
};

// Exécuter la tâche toutes les 24 heures
setInterval(deleteExpiredFiles, 24 * 60 * 60 * 1000);

const giveCurrentDateTime = () => {
  const today = new Date();
  const date =
    today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate();
  const time =
    today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
  const dateTime = date + " " + time;
  return dateTime;
};

function generateShortId(length: number = 6): string {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length);
}

// Validation d'URL renforcée
const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return /^https?:/.test(url);
  } catch {
    return false;
  }
};

export const unshorteen = async (req: Request, res: Response) => {
  try {
    const { hash } = req.params;

    if (!hash) {
      res.status(400).json({ message: "URL invalide" });
      return;
    }

    const { rows } = await client.query(
      "SELECT * FROM url WHERE short_id = $1",
      [hash]
    );

    if (rows.length === 0) {
      res.status(404).json({ message: "URL non trouvée" });
      return;
    }

    res.redirect(rows[0].original_url);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};