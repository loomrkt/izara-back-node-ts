import * as http from 'http';
import { Server } from "socket.io";
import app from "./app";

const normalizePort = (val: string): number | string => {
  const port = parseInt(val, 10);

  if (isNaN(port)) {
    return val;
  }
  if (port >= 0) {
    return port;
  }
  return val;
};

const port: number | string = normalizePort(process.env.PORT || "3000");
app.set("port", port);

const errorHandler = (error: NodeJS.ErrnoException) => {
  if (error.syscall !== "listen") {
    throw error;
  }
  const address = server.address();
  const bind =
    typeof address === "string" ? "pipe " + address : "port: " + port;
  switch (error.code) {
    case "EACCES":
      console.error(bind + " requires elevated privileges.");
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(bind + " is already in use.");
      process.exit(1);
      break;
    default:
      throw error;
  }
};

// Créer le serveur HTTP
const server = http.createServer(app);

// Initialiser Socket.IO
const io = new Server(server, { cors: { origin: "*" } });

// Gérer les événements Socket.IO
io.on("connection", (socket) => {
  console.log("Un client s'est connecté :", socket.id);

  socket.on("disconnect", () => {
    console.log("Un client s'est déconnecté :", socket.id);
  });
});

server.on("error", errorHandler);
server.on("listening", () => {
  const address = server.address();
  const bind = typeof address === "string" ? "pipe " + address : "port " + port;
  console.log("Listening on " + bind);
});

server.listen(port, () => {
  console.log(`Server is running on port ${port} 🎧`);
});

export default server; // <-- Ajout de l'exportation par défaut
export { io };