"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const router = express_1.default.Router();
router.post("/login", auth_controller_1.login);
router.post("/register", auth_controller_1.register);
router.get("/refresh", auth_controller_1.refreshToken);
router.get("/logout", auth_controller_1.logout);
router.get("/google", auth_controller_1.loginWithGoogle);
router.get("/google/callback", auth_controller_1.googleCallback);
router.get("/checkAuth", auth_middleware_1.verifyAccessToken, auth_controller_1.checkAuth);
exports.default = router;
