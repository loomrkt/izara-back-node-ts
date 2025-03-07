"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAccessToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// Middleware pour vérifier l'Access Token
const verifyAccessToken = (req, res, next) => {
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
        const decoded = jsonwebtoken_1.default.verify(accessToken, process.env.JWT_SECRET);
        // Vérifier l'expiration de l'AT
        if (decoded.expiresIn < Math.floor(Date.now() / 1000)) {
            res.status(401).json({ error: "Token expiré" });
            return;
        }
        console.log(decoded);
        req.user = decoded;
        next(); // Passer au prochain middleware ou route
    }
    catch (error) {
        res.status(401).json({ message: "Invalid or expired access token" });
        return;
    }
};
exports.verifyAccessToken = verifyAccessToken;
