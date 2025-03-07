import express from 'express';
import dotenv from 'dotenv';
import client from './utils/database';
import morgan from 'morgan';
import bodyParser from 'body-parser';
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

client
  .connect()
  .then(() => console.log("Connected to postgres database ☁"))
  .catch((err) => console.error("Connection error ⛈", err.stack));

app.use(morgan("dev"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.use("/auth", AuthRoute);
app.use("/user", UserRoute);
app.use("/files", filesRoute);

export default app;
