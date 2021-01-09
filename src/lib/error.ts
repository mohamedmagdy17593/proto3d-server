import { NextFunction, Request, Response } from 'express';

export class HttpException extends Error {
  status: number;
  message: string;

  constructor(status = 500, message = 'Something went wrong') {
    super(message);
    this.status = status;
    this.message = message;
  }
}

export function errorMiddleware(
  err: HttpException,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) {
  let { status = 500, message = 'something_went_wrong' } = err;

  let errorBody: { [key: string]: any } = {
    path: req.path,
    timestamp: +new Date(),
    message,
  };

  res.status(status).send(errorBody);
}
