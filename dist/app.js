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
exports.sendSSE = sendSSE;
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
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
app.use((0, morgan_1.default)("dev"));
app.use(body_parser_1.default.urlencoded({ extended: false }));
app.use(body_parser_1.default.json());
app.get("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.json({ message: "Hello World" });
}));
let clients = [];
// Route SSE modifiée pour accepter un ID client
app.get("/sse/:clientId", (req, res) => {
    const clientId = req.params.clientId;
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        Connection: "keep-alive",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "*",
    });
    const newClient = {
        id: clientId,
        response: res,
    };
    clients = clients.filter((client) => client.id !== clientId);
    clients.push(newClient);
    req.on("close", () => {
        clients = clients.filter((client) => client.id !== clientId);
    });
});
// Fonction d'envoi modifiée pour cibler un client spécifique
function sendSSE(clientId, data, eventName = "message") {
    const client = clients.find((c) => c.id === clientId);
    if (client) {
        client.response.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
    }
}
app.use("/auth", auth_routes_1.default);
app.use("/user", user_routes_1.default);
app.use("/files", files_routes_1.default);
exports.default = app;
