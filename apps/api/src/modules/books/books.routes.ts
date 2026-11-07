import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import {
  booksQuerySchema,
  createBookRequestSchema,
  updateBookRequestSchema,
} from '@storylib/shared';
import type { AppEnv } from '../../shared/app-env';
import { AppError } from '../../shared/errors';
import { validationHook } from '../../shared/validate';
import { requireRole } from '../auth/middleware';
import type { BookService } from './books.service';

export function booksRoutes(service: BookService) {
  return new Hono<AppEnv>()
    // Reading: open to every signed-in mode, including a kid token.
    .get('/', zValidator('query', booksQuerySchema, validationHook), async (c) =>
      c.json(await service.list(c.get('user'), c.get('scope'), c.req.valid('query'), c.get('locale'))),
    )
    .get('/:id', async (c) =>
      c.json(await service.detail(c.get('user'), c.get('scope'), c.req.param('id'), c.get('locale'))),
    )
    .get('/:id/pages', async (c) =>
      c.json(await service.pages(c.get('user'), c.get('scope'), c.req.param('id'), c.get('locale'))),
    )
    .get('/:id/pages/:n', async (c) => {
      const n = c.req.param('n');
      if (!/^\d+$/.test(n)) throw new AppError('NOT_FOUND', 'Page not found.');
      return c.json(await service.page(c.get('user'), c.get('scope'), c.req.param('id'), Number(n), c.get('locale')));
    })
    // Creator-only writes.
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
