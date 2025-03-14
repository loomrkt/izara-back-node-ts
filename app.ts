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

app.use("/auth", AuthRoute);
app.use("/user", UserRoute);
app.use("/files", filesRoute);

export default app;
