"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAuth = exports.logout = exports.refreshToken = exports.register = exports.login = exports.googleCallback = exports.loginWithGoogle = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../../utils/database");
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
const dotenv = __importStar(require("dotenv"));
dotenv.config;
const ACCESS_TOKEN_EXPIRES_IN = "15m";
const REFRESH_TOKEN_EXPIRES_IN = "7d";
function generateStrongPassword(length = 16) {
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*()-_=+[]{}|;:'\",.<>?/";
    const allCharacters = uppercase + lowercase + numbers + symbols;
    let password = "";
    // S'assurer que le mot de passe contient au moins un de chaque type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    // Remplir le reste avec des caractères aléatoires
    for (let i = password.length; i < length; i++) {
        password +=
            allCharacters[Math.floor(Math.random() * allCharacters.length)];
    }
    // Mélanger les caractères pour éviter un motif prévisible
    return password
        .split("")
        .sort(() => 0.5 - Math.random())
        .join("");
}
passport_1.default.use(new passport_google_oauth20_1.Strategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.BACKEND_URL}/auth/google/callback`,
}, (accessToken, refreshToken, profile, done) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        // Vérifier si l'utilisateur existe déjà
        let { data: newUser, error } = yield database_1.supabase
            .from("users")
            .select("*")
            .or(`email.eq.${(_a = profile.emails) === null || _a === void 0 ? void 0 : _a[0].value},google_id.eq.${profile.id}`)
            .single();
        let user = newUser;
        // Si l'utilisateur n'existe pas, l'insérer
        if (!user) {
            const { data, error: insertError } = yield database_1.supabase
                .from("users")
                .insert([
                {
                    email: (_b = profile.emails) === null || _b === void 0 ? void 0 : _b[0].value,
                    google_id: profile.id,
                    password: generateStrongPassword(),
                },
            ])
                .select()
                .single();
            if (insertError) {
                throw insertError;
            }
            user = data;
        }
        console.log(user);
        done(null, user);
    }
    catch (err) {
        console.error("Erreur lors de la récupération ou de l'insertion de l'utilisateur :", err);
        done(err, false);
    }
})));
exports.loginWithGoogle = passport_1.default.authenticate("google", {
    scope: ["profile", "email"],
});
const googleCallback = (req, res) => {
    passport_1.default.authenticate("google", { session: false }, (err, user) => __awaiter(void 0, void 0, void 0, function* () {
        if (err || !user) {
            return res.status(401).json({ message: `${err} and ${user}` });
        }
        const accessToken = jsonwebtoken_1.default.sign({ id: user.id, type: "access" }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
        const refreshToken = jsonwebtoken_1.default.sign({ id: user.id, type: "refresh" }, process.env.JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "none",
            maxAge: 15 * 60 * 1000,
        });
        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "none",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        const redirectUrl = `${process.env.FRONTEND_URL}/dashboard` ||
            "http://localhost:4200/dashboard";
        res.redirect(redirectUrl);
    }))(req, res);
};
exports.googleCallback = googleCallback;
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        // Validation des entrées
        if (!email || !password) {
            res.status(400).json({ message: "Email and password are required" });
            return;
        }
        // Récupérer l'utilisateur depuis la base de données
        const { data: user, error } = yield database_1.supabase
            .from("users")
            .select("*")
            .eq("email", email)
            .single();
        if (error && error.code === "PGRST116") {
            res.status(401).json({ error: "User not found" });
            return;
        }
        if (error) {
            throw error;
        }
        // Comparer le mot de passe fourni avec le mot de passe haché
        const isMatch = yield bcryptjs_1.default.compare(password, user.password);
        if (!isMatch) {
            res.status(401).json({ error: "Invalid credentials" });
            return;
        }
        // Générer les jetons JWT
        const accessToken = jsonwebtoken_1.default.sign({ id: user.id, type: "access" }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
        const refreshToken = jsonwebtoken_1.default.sign({ id: user.id, type: "refresh" }, process.env.JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
        // Définir les cookies et envoyer la réponse
        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "none",
            maxAge: 15 * 60 * 1000,
        });
        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "none",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        res.status(201).json({ message: "Logged in successfully" });
        return;
    }
    catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Internal server error" });
        return;
    }
});
exports.login = login;
const register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        console.log(req.body);
        // Validation de l'email et du mot de passe
        if (!email || !password) {
            res.status(401).json({ message: "Invalid email or password" });
            return;
        }
        // Vérification de la validité de l'email avec une regex
        const emailRegex = /\S+@\S+\.\S+/;
        if (!emailRegex.test(email)) {
            res.status(401).json({ message: "Invalid email or password" });
            return;
        }
        // Vérification si l'utilisateur existe déjà
        const { data: existingUsers, error: selectError } = yield database_1.supabase
            .from("users")
            .select("*")
            .eq("email", email);
        if (selectError) {
            throw selectError;
        }
        if (existingUsers.length > 0) {
            res.status(400).json({ message: "User already exists" });
            return;
        }
        // Hachage du mot de passe
        const hashedPassword = yield bcryptjs_1.default.hash(password, 10);
        // Insertion de l'utilisateur dans la base de données
        const { data, error: insertError } = yield database_1.supabase
            .from("users")
            .insert([
            {
                email,
                password: hashedPassword,
            },
        ])
            .select()
            .single();
        if (insertError) {
            throw insertError;
        }
        res.status(201).json(data);
        return;
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Registration failed" });
        return;
    }
});
exports.register = register;
const refreshToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const refreshToken = req.cookies["refreshToken"];
    if (!refreshToken) {
        res.status(401).json({ error: "Refresh token required" });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(refreshToken, process.env.JWT_SECRET);
        if (decoded.type !== "refresh") {
            res.status(401).json({ error: "Invalid refresh token type" });
            return;
        }
        if (decoded.expiresIn < Math.floor(Date.now() / 1000)) {
            res.status(401).json({ error: "Refresh token expiré" });
            return;
        }
        const newAccessToken = jsonwebtoken_1.default.sign({ id: decoded.id, type: "access" }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
        const newRefreshToken = jsonwebtoken_1.default.sign({ id: decoded.id, type: "refresh" }, process.env.JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
        res.cookie("accessToken", newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "none",
            maxAge: 15 * 60 * 1000,
        });
        res.clearCookie("refreshToken");
        res.cookie("refreshToken", newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "none",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        res.status(200).json({ message: "Access token refreshed" });
        return;
    }
    catch (error) {
        res.status(403).json({ error: "Invalid or expired refresh token" });
        return;
    }
});
exports.refreshToken = refreshToken;
const logout = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.cookie("accessToken", "", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "none",
            expires: new Date(0),
        });
        res.cookie("refreshToken", "", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "none",
            expires: new Date(0),
        });
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        res.clearCookie("accessToken");
        res.clearCookie("refreshToken");
        res.json({ message: "Logged out successfully" });
    }
    catch (error) {
        console.error("Logout error:", error);
        res.status(401).json({ error: "Invalid token" });
    }
});
exports.logout = logout;
const checkAuth = (req, res) => {
    // Si le middleware vérifie que l'AT est valide, on peut accéder à cette route
    res.status(200).json({ authenticated: true });
};
exports.checkAuth = checkAuth;
