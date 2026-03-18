import { Elysia, t } from 'elysia';
import db from '../../db/client';
import {
  handleCreateLink,
  handleListLinks,
  handleGetLink,
  handleUpdateLink,
  handleDeleteLink,
  handleRedirect,
  handleLikeLink,
  handleUnlikeLink,
  handleFavoriteLink,
  handleUnfavoriteLink,
  handleGetSocialStatus,
  handleGetDashboard,
  handleGetPublicLinks,
} from './links.controller';
import { authMiddleware } from '../../middleware/auth';
import { rateLimit } from '../../middleware/rateLimit';

const redirectRoute = rateLimit({
  maxRequests: 60,
  windowMs: 60000,
}).get('/r/:code', ({ db, params, set, request, user }) => handleRedirect({ db, params, set, request, user }));

const linksRoutes = (app: Elysia) =>
  app
    .use(redirectRoute)
    .get('/api/links/public', ({ db, query }) => handleGetPublicLinks({ db, query }))
    .group('/api/links', (app) =>
      app
        .use(authMiddleware)
        .get('/', ({ user, db, query }) => handleListLinks({ user, db, query }))
        .post('/', ({ user, db, body, set }) => handleCreateLink({ user, db, body, set }), {
          body: t.Object({
            name: t.String(),
            url: t.String(),
            is_public: t.Optional(t.Boolean()),
          }),
        })
        .get('/:id', ({ user, db, params, set }) => handleGetLink({ user, db, params, set }))
        .patch('/:id', ({ user, db, params, body, set }) => handleUpdateLink({ user, db, params, body, set }), {
          body: t.Object({
            name: t.Optional(t.String()),
            url: t.Optional(t.String()),
            is_public: t.Optional(t.Boolean()),
          }),
        })
        .delete('/:id', ({ user, db, params, set }) => handleDeleteLink({ user, db, params, set }))
        .post('/:id/like', ({ user, db, params, set }) => handleLikeLink({ user, db, params, set }))
        .delete('/:id/like', ({ user, db, params, set }) => handleUnlikeLink({ user, db, params, set }))
        .post('/:id/favorite', ({ user, db, params, set }) => handleFavoriteLink({ user, db, params, set }))
        .delete('/:id/favorite', ({ user, db, params, set }) => handleUnfavoriteLink({ user, db, params, set }))
        .get('/:id/social', ({ user, db, params }) => handleGetSocialStatus({ user, db, params }))
    )
    .group('/api/dashboard', (app) =>
      app
        .use(authMiddleware)
        .get('/', ({ user, db, query }) => handleGetDashboard({ user, db, query }), {
          query: t.Object({
            page: t.Optional(t.String()),
            limit: t.Optional(t.String()),
            category_id: t.Optional(t.String()),
            search: t.Optional(t.String()),
            sort: t.Optional(t.String()),
            order: t.Optional(t.String()),
          }),
        })
    );

export { linksRoutes };
