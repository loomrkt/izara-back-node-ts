import { Request, Response } from "express";
import { supabase } from "../../utils/database";
import { firebaseConfig } from "../../utils/firebase";
import { initializeApp } from "firebase/app";
import {
  getStorage,
  ref,
  getDownloadURL,
  uploadBytesResumable,
  deleteObject,
} from "firebase/storage";
import archiver from "archiver";
import { PassThrough } from "stream";
import * as crypto from "crypto";
import { sendSSE } from "../../app";

interface User {
  id: string;
}
initializeApp(firebaseConfig);
const storage = getStorage();

// Get files for current user
export const getFiles = async (req: Request, res: Response) => {
  try {
    // Récupérer les fichiers de l'utilisateur
    const { data: files, error } = await supabase
      .from("files")
      .select("*")
      .eq("user_id", (req.user as User).id);

    if (error) {
      throw error;
    }

    // Renvoyer les fichiers
    res.status(200).json(files);
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
    return;
  }
};

// Create file with user association
export const createFile = async (req: Request, res: Response) => {
  try {
    const { titre, clientId } = req.body;
    const userId = (req.user as User).id;

    if (!req.file) {
      res.status(400).json({ error: "Aucun fichier fourni." });
      return;
    }

    // Ici, TypeScript sait que req.file n'est plus undefined
    const { size } = req.file;

    const dateTime = giveCurrentDateTime();
    const passThrough = new PassThrough();
    const archive = archiver("zip", { zlib: { level: 9 } });

    // Gestionnaire d'événements de compression
    archive.on("warning", (error) => {
      console.warn("Avertissement lors de la compression :", error);
    });

    archive.on("error", (error) => {
      console.error("Erreur lors de la compression :", error);
      res.status(500).json({ message: "Internal server error" });
    });

    archive.on("end", async () => {
      sendSSE(
        clientId,
        { progress: Math.floor(Number(100)) },
        "compressProgress"
      );
    });

    archive.pipe(passThrough);
    archive.append(req.file.buffer, { name: req.file.originalname });
    archive.finalize();

    const storageRef = ref(storage, `files/${titre + dateTime}.zip`);
    const metadata = { contentType: "application/zip" };

    const chunks: Buffer[] = [];
    let processedsize = 0;
    let lastProgress = 0;
    passThrough.on("data", (chunk) => {
      processedsize += chunk.length;
      const uploadPercent = ((processedsize / archive.pointer()) * 100).toFixed(
        2
      );
      if (parseInt(uploadPercent) > lastProgress) {
        lastProgress = parseInt(uploadPercent);
        sendSSE(
          clientId,
          { progress: Math.floor(parseInt(uploadPercent)) },
          "compressProgress"
        );
      }
      chunks.push(chunk);
    });
    passThrough.on("end", () => {
      const buffer = Buffer.concat(chunks);
      const uploadTask = uploadBytesResumable(storageRef, buffer, metadata);

      // Upload phase with 100% weight
      let lastUploadProgress = 0; //  0% (upload)

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const uploadPercent =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          const totalProgress = Math.floor(uploadPercent);
          if (totalProgress > lastUploadProgress) {
            for (let i = lastUploadProgress + 1; i <= totalProgress; i++) {
              sendSSE(
                clientId,
                { progress: Math.floor(Number(uploadPercent)) },
                "uploadProgress"
              );
            }
            lastUploadProgress = totalProgress;
          }
        },
        (error) => {
          console.error("Erreur d'upload :", error);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

          const taille = uploadTask.snapshot.bytesTransferred;
          const shortId = generateShortId();
          const expirationDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

          const { data: rows, error: insertError } = await supabase
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

          if (insertError) throw insertError;

          res.status(201).json(rows[0]);
        }
      );
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
    const { data: file, error: selectError } = await supabase
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
    const fileRef = ref(storage, fileUrl); // Utilisez l'URL ou une référence spécifique au fichier
    await deleteObject(fileRef);

    // Supprimer le fichier de la base de données
    const { error: deleteDbError } = await supabase
      .from("files")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (deleteDbError) {
      res.status(500).json({
        message:
          "Erreur lors de la suppression du fichier de la base de données",
      });
      return;
    }

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
    const { data: files, error: selectError } = await supabase
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
        const { error: deleteStorageError } = await supabase.storage
          .from("files") // Assurez-vous d'utiliser le bon nom du bucket
          .remove([fileUrl]);

        if (deleteStorageError) {
          console.error(
            `Erreur lors de la suppression du fichier ${file.titre} du stockage :`,
            deleteStorageError
          );
          continue; // Passer au fichier suivant en cas d'erreur
        }

        // Supprimer le fichier de la base de données
        const { error: deleteDbError } = await supabase
          .from("files")
          .delete()
          .eq("id", file.id);

        if (deleteDbError) {
          console.error(
            `Erreur lors de la suppression du fichier ${file.titre} de la base de données :`,
            deleteDbError
          );
          continue; // Passer au fichier suivant en cas d'erreur
        }

      }
    }
  } catch (error) {
    console.error(
      "Erreur lors de la suppression des fichiers expirés :",
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
  
    // Rechercher l'URL dans la base de données
    const { data: urlData, error: selectError } = await supabase
      .from("url")
      .select("*")
      .eq("short_id", hash)
      .single();  // Récupère un seul enregistrement
  
    if (selectError || !urlData) {
       res.status(404).json({ message: "URL non trouvée" });
       return;
    }
  
    // Rediriger vers l'URL originale
    res.redirect(urlData.original_url);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
  
};