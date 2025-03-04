import { RequestHandler } from "express";

export class AuthController {
    static login: RequestHandler = (req, res) => {
        res.send('Login route');
    };

    static register: RequestHandler = (req, res) => {
        res.send('Register route');
    };
}