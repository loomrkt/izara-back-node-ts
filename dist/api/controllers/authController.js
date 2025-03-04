"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
class AuthController {
}
exports.AuthController = AuthController;
AuthController.login = (req, res) => {
    res.send('Login route');
};
AuthController.register = (req, res) => {
    res.send('Register route');
};
