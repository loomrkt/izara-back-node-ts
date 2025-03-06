import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Middleware pour vérifier l'Access Token
export const verifyAccessToken = (req: Request, res: Response, next: NextFunction) => {
  // Récupérer le token depuis les cookies
  const accessToken = req.cookies['accessToken'];

  // Vérifier si le token est présent
  if (!accessToken) {
     res.status(401).json({ message: 'Access token is missing' });
     return;
  }

  try {
    // Vérifier la validité du token
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET as string) as jwt.JwtPayload;
    req.user = decoded;
    next(); // Passer au prochain middleware ou route
  } catch (error) {
     res.status(401).json({ message: 'Invalid or expired access token' });
     return;
  }
};
