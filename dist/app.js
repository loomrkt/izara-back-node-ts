"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const database_1 = __importDefault(require("./utils/database"));
const morgan_1 = __importDefault(require("morgan"));
const body_parser_1 = __importDefault(require("body-parser"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const auth_routes_1 = __importDefault(require("./api/routes/auth.routes"));
const user_routes_1 = __importDefault(require("./api/routes/user.routes"));
const files_routes_1 = __importDefault(require("./api/routes/files.routes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL, // 🔥 Remplace par l'URL de ton frontend
    credentials: true, // ✅ Autorise les cookies et les sessions
    allowedHeaders: ["Content-Type", "Authorization"], // ✅ Facultatif
    methods: ["GET", "POST", "PUT", "DELETE"], // ✅ Facultatif
}));
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json());
database_1.default
    .connect()
    .then(() => console.log("Connected to postgres database ☁"))
    .catch((err) => console.error("Connection error ⛈", err.stack));
app.use((0, morgan_1.default)("dev"));
app.use(body_parser_1.default.urlencoded({ extended: false }));
app.use(body_parser_1.default.json());
app.get("/", (req, res) => {
    res.send("Hello World!");
});
app.use("/auth", auth_routes_1.default);
app.use("/user", user_routes_1.default);
app.use("/files", files_routes_1.default);
exports.default = app;
