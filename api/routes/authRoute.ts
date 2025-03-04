import { Router } from "express";
import { AuthController } from "../controllers/authController";

const router = Router();

export class AuthRoute {
    private controller: AuthController;

    constructor() {
        this.controller = new AuthController();
    }

    static routes(): Router {
        router.post('/register', AuthController.register);
        router.post('/login', AuthController.login);
        return router;
    }
}
