import { NextFunction, Request, Response } from "express";
import multer, { MulterError } from "multer";

const invalidMimes = [
  "application/x-msdownload", // Exécutables Windows
  "application/x-shockwave-flash", // Fichiers Flash
  "application/x-msdos-program",
  "application/x-dmg", // Images disque Mac
  "application/vnd.android.package-archive", // APK Android
];

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (req, file, cb) => {
    if (invalidMimes.includes(file.mimetype)) {
      cb(new Error(`Type de fichier interdit : ${file.mimetype}`));
    } else {
      cb(null, true);
    }
  },
});

// Middleware de gestion d'erreurs typé
export const handleUploadErrors = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof MulterError) {
    res.status(400).json({
      success: false,
      error:
        err.code === "LIMIT_FILE_SIZE"
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
