import express from 'express';
import dotenv from 'dotenv';
import morgan from "morgan";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";
import AuthRoute from "./api/routes/auth.routes";
import UserRoute from "./api/routes/user.routes";
import filesRoute from "./api/routes/files.routes";
dotenv.config();
const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL, // 🔥 Remplace par l'URL de ton frontend
    credentials: true, // ✅ Autorise les cookies et les sessions
    allowedHeaders: ["Content-Type", "Authorization"], // ✅ Facultatif
    methods: ["GET", "POST", "PUT", "DELETE"], // ✅ Facultatif
  })
);

app.use(cookieParser());
app.use(express.json());

app.use(morgan("dev"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get("/", async (req, res) => {
  res.json({ message: "Hello World" });
});

// Modifiez l'interface Client pour inclure un identifiant unique
interface Client {
  id: string; // Utilisez un UUID ou une chaîne unique
  response: express.Response;
}

let clients: Client[] = [];

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
export function sendSSE(
  clientId: string,
  data: object,
  eventName: string = "message"
) {
  const client = clients.find((c) => c.id === clientId);
  if (client) {
    client.response.write(
      `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`
    );
  }
}

app.use("/auth", AuthRoute);
app.use("/user", UserRoute);
app.use("/files", filesRoute);

export default app;
