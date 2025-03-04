import express from 'express';
import dotenv from 'dotenv';
import client from './utils/database';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import { RequestHandler } from 'express';

import { AuthRoute } from './api/routes/authRoute';

dotenv.config();
const app = express();

client.connect()
    .then(() => console.log('Connected to postgres database ☁'))
    .catch((err) => console.error('Connection error ⛈', err.stack));

app.use(morgan('dev'));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

const corsMiddleware: RequestHandler = (req, res, next) => {
    res.header('Access-Control-Allow-Origin','*');
    res.header('Access-Control-Allow-Headers','Origin,X-Requested-With,Content-Type,Accept,Authorization');
    if(req.method === 'OPTIONS'){
        res.header('Access-Control-Allow-Methods','PUT,POST,PATCH,DELETE,GET');
        res.status(200).json({});
    } else {
        next();
    }
};

app.use(corsMiddleware);


app.get('/', (req, res) => {
    res.send('Hello World!');
});


app.use('/auth', AuthRoute.routes());


export default app;