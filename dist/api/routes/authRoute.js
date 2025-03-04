"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthRoute = void 0;
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const router = (0, express_1.Router)();
class AuthRoute {
    constructor() {
        this.controller = new authController_1.AuthController();
    }
    static routes() {
        router.post('/register', authController_1.AuthController.register);
        router.post('/login', authController_1.AuthController.login);
        return router;
    }
}
exports.AuthRoute = AuthRoute;
