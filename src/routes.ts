import express from 'express';
import { asyncHandler } from './utils/helpers';
import { requestUploadModel } from './utils/model';

const router = express.Router();

router.get(
  '/',
  asyncHandler((req, res) => {
    res.send({ hello: 'World' });
  }),
);

router.post(
  '/api/upload-model',
  asyncHandler((req, res) => {
    let { url } = req.body;

    requestUploadModel(url);

    res.send({ done: true });
  }),
);

export default router;
