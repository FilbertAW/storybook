import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { createBookRequestSchema, updateBookRequestSchema } from '@storylib/shared';
import type { AppEnv } from '../../shared/app-env';
import { validationHook } from '../../shared/validate';
import { requireRole } from '../auth/middleware';
import type { BookService } from './books.service';

// Creator-only writes. The read endpoints for parents and kids join this router
// with the access rules.
export function booksRoutes(service: BookService) {
  return new Hono<AppEnv>()
    .post(
      '/',
      requireRole('creator'),
      zValidator('json', createBookRequestSchema, validationHook),
      async (c) => c.json(await service.create(c.get('user'), c.req.valid('json')), 201),
    )
    .patch(
      '/:id',
      requireRole('creator'),
      zValidator('json', updateBookRequestSchema, validationHook),
      async (c) => c.json(await service.update(c.get('user'), c.req.param('id'), c.req.valid('json'))),
    )
    .delete('/:id', requireRole('creator'), async (c) =>
      c.json(await service.remove(c.get('user'), c.req.param('id'))),
    );
}

export function creatorRoutes(service: BookService) {
  return new Hono<AppEnv>().get('/books', requireRole('creator'), async (c) =>
    c.json(await service.listOwn(c.get('user'))),
  );
}
