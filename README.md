# BaixKZ Backend

Fastify + TypeScript API. Firebase Authentication ID tokens are verified on the server. PostgreSQL is the intended application database; Prisma is the data-access layer so the database can be hosted in Kazakhstan later.

## Local start

1. Install Node.js 20 or newer and Docker Desktop.
2. Copy `.env.example` to `.env` and set `SUPER_ADMIN_UID` to the permanent Firebase Authentication UID.
3. Put a Firebase service-account JSON file at `secrets/firebase-service-account.json` (never commit this file). In Firebase Console, create it under Project settings → Service accounts.
4. Run `docker compose up -d`.
5. Run `npm install`.
6. Run `npx prisma generate`.
7. Run `npx prisma migrate dev --name initial_schema`.
8. Run `npm run dev`.

API health: `GET http://localhost:4000/api/v1/health`.

## API

- `POST /api/v1/me/sync` — authenticated user profile sync to PostgreSQL.
- `GET /api/v1/stores` — public active stores, paginated.
- `GET /api/v1/stores/:storeId` — public store and active products.
- `POST /api/v1/stores` — authenticated store registration; new stores are pending moderation.
- `GET /api/v1/my/store` — current user's store and products.
- `POST /api/v1/my/store/products` — add product after store approval.
- `PATCH /api/v1/my/store/products/:productId` — edit owned product.
- `DELETE /api/v1/my/store/products/:productId` — hide owned product.
- `/api/v1/admin/*` — role-protected management endpoints.

Authenticated requests must send `Authorization: Bearer <Firebase ID token>`.

## Important security notes

- Never commit `.env`, Firebase service-account JSON, database credentials, or production secrets.
- The Super Admin is selected by Firebase UID in `SUPER_ADMIN_UID`; it is not a client-side switch.
- Other admin roles are checked by the API against PostgreSQL. Hiding a button in the browser is not authorization.
- Admin audit logs are only exposed as read operations in this API; do not grant normal users database access.
- This initial API implements store/product and basic admin workflows. Payments, delivery, order processing, image uploads, subscriptions, automated account deletion, and legal retention workflows are intentionally not activated until their business/legal requirements are defined.
