import express from 'express';
import cors from 'cors';
import { errorMiddleware } from './lib/error';

import routes from './routes';

const app = express();

app.use(express.json());
app.use(cors());

app.use(routes);

app.use(errorMiddleware);

export default app;
