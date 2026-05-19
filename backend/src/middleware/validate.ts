import { AnyZodObject, ZodError } from 'zod';
import { NextFunction, Request, Response } from 'express';

export function validate(schema: AnyZodObject) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const messages = error.errors.map(
          (e) => `${e.path.join('.')} ${e.message}`,
        );
        return res.status(400).json({
          message: `Invalid input: ${messages.join(', ')}`,
        });
      }
      return next(error);
    }
  };
}

export function parseOrThrow<T>(schema: AnyZodObject, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const messages = result.error.errors.map(
      (e) => `${e.path.join('.')} ${e.message}`,
    );
    throw new Error(messages.join(', '));
  }
  return result.data as T;
}
