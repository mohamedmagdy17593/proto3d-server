import express from 'express';
import { asyncHandler } from './lib/helpers';
import { requestUploadModel, searchModels } from './lib/model';
import prisma from './lib/prisma';
import { HttpException } from './lib/error';
import { ModelStatus, SketchfabModel } from './type';

const router = express.Router();

router.get(
  '/',
  asyncHandler((req, res) => {
    res.send({ hello: 'World' });
  }),
);

router.get(
  '/api/models',
  asyncHandler(async (req, res) => {
    let { search } = req.query;

    let result = await searchModels(search as string);

    res.send({ result });
  }),
);

router.post(
  '/api/upload-model',
  asyncHandler(async (req, res) => {
    let {
      id,
      name,
      sketchfabUrl,
      imgSmall,
      imgLarge,
    }: SketchfabModel = req.body;

    // create model record in our database
    let model = await prisma.model.findFirst({ where: { id } });
    if (model) {
      if (model.status === ('uploaded' as ModelStatus)) {
        throw new HttpException(400, 'This model is already uploaded');
      } else {
        // the model is saved we will retry again
      }
    } else {
      await prisma.model.create({
        data: { id, name, sketchfabUrl, imgSmall, imgLarge },
      });
    }

    // start uploading job
    requestUploadModel({ id, name, sketchfabUrl, imgSmall, imgLarge });

    res.send({ done: true });
  }),
);

router.get(
  '/api/model/:id',
  asyncHandler(async (req, res) => {
    let { id } = req.params;

    let model = await prisma.model.findFirst({ where: { id } });

    res.send({ model });
  }),
);

export default router;
