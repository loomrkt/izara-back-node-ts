import express from "express";
import { login, register,refreshToken,logout, loginWithGoogle, googleCallback,checkAuth } from "../controllers/auth.controller";
import { verifyAccessToken } from "../../middlewares/auth.middleware";

const router = express.Router();

router.post("/login", login);
router.post("/register", register);
router.get("/refresh", refreshToken);
router.get("/logout", logout);
router.get("/google", loginWithGoogle);
router.get("/google/callback", googleCallback);
router.get("/checkAuth", verifyAccessToken, checkAuth);

export default router;
