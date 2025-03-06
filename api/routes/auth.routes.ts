import express from "express";
import { login, register,refreshToken,logout, loginWithGoogle, googleCallback,checkAuth } from "../controllers/auth.controller";

const router = express.Router();

router.post("/login", login);
router.post("/register", register);
router.get("/refresh", refreshToken);
router.get("/logout", logout);
router.get("/google", loginWithGoogle);
router.get("/google/callback", googleCallback);
router.get("/checkAuth", checkAuth);

export default router;
