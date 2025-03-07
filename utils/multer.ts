import multer from 'multer';

export const upload = multer({
  storage: multer.memoryStorage(), // Garde le fichier en mémoire
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (req, file, cb) => {
    const validMimes = [
      'application/zip', 
      'application/x-rar-compressed',
      'image/*', // Tous types images
      'video/*', // Tous types vidéos
      'text/plain',
      'application/octet-stream' // Fallback
    ];
    
    if (validMimes.some(mime => file.mimetype.match(mime))) {
      cb(null, true);
    } else {
      cb(new Error(`Type non supporté: ${file.mimetype}`));
    }
  }
});