import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Middleware pour vérifier l'Access Token
export const verifyAccessToken = (req: Request, res: Response, next: NextFunction) => {
  // Récupérer le token depuis les cookies
  const accessToken = req.cookies['accessToken'];
  console.log(accessToken);
  // Vérifier si le token est présent
  if (!accessToken) {
    res.status(401).json({ message: "Access token is missing" });
    return;
  }

  try {
    // Vérifier la validité du token
    const decoded = jwt.verify(
      accessToken,
      process.env.JWT_SECRET as string
    ) as jwt.JwtPayload;

    // Vérifier l'expiration de l'AT
    if ((decoded as jwt.JwtPayload).expiresIn < Math.floor(Date.now() / 1000)) {
      res.status(401).json({ error: "Token expiré" });
      return;
    }
    console.log(decoded);
    req.user = decoded;
    next(); // Passer au prochain middleware ou route
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired access token" });
    return;
  }
};
