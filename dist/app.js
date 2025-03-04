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
const authRoute_1 = require("./api/routes/authRoute");
dotenv_1.default.config();
const app = (0, express_1.default)();
database_1.default.connect()
    .then(() => console.log('Connected to postgres database ☁'))
    .catch((err) => console.error('Connection error ⛈', err.stack));
app.use((0, morgan_1.default)('dev'));
app.use(body_parser_1.default.urlencoded({ extended: false }));
app.use(body_parser_1.default.json());
const corsMiddleware = (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization');
    if (req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Methods', 'PUT,POST,PATCH,DELETE,GET');
        res.status(200).json({});
    }
    else {
        next();
    }
};
app.use(corsMiddleware);
app.get('/', (req, res) => {
    res.send('Hello World!');
});
app.use('/auth', authRoute_1.AuthRoute.routes());
exports.default = app;
