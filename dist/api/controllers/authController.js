"use strict";
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
exports.register = exports.login = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = __importDefault(require("../../utils/database"));
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ message: "Invalid email or password" });
            return;
        }
        const { rows } = yield database_1.default.query("SELECT * FROM users WHERE email = $1", [email]);
        if (rows.length === 0) {
            res.status(401).json({ message: "Invalid credentials" });
            return;
        }
        const user = rows[0];
        const isMatch = yield bcryptjs_1.default.compare(password, user.password);
        if (!isMatch) {
            res.status(401).json({ message: "Invalid credentials" });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET || "random123Secret", { expiresIn: "1h" });
        res.json({ token });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Login failed" });
    }
});
exports.login = login;
const register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        console.log(req.body);
        //validate email and password
        if (!email || !password) {
            res.status(400).json({ message: "Invalid email or password" });
            return;
        }
        //check if email is valid use regex
        const emailRegex = /\S+@\S+\.\S+/;
        if (!emailRegex.test(email)) {
            res.status(400).json({ message: "Invalid email" });
            return;
        }
        //check if user already exists
        const { rows: existingUsers } = yield database_1.default.query("SELECT * FROM users WHERE email = $1", [email]);
        if (existingUsers.length > 0) {
            res.status(400).json({ message: "User already exists" });
            return;
        }
        const hashedPassword = yield bcryptjs_1.default.hash(password, 10);
        const { rows } = yield database_1.default.query("INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *", [email, hashedPassword]);
        res.status(201).json(rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Registration failed" });
    }
});
exports.register = register;
const generateToken = (userId) => {
    return jsonwebtoken_1.default.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: "1h",
    });
};
