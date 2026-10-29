# Carrlo Deployment Notes

Carrlo is not yet deployed or production-verified.

Required services:

- Managed PostgreSQL
- Stable `AUTH_SECRET`
- Application host compatible with Next.js
- Private object storage before document uploads are exposed to production users
- Durable rate limiting before public credentials auth is exposed

Deployment checklist:

```bash
npm ci
npm run db:generate
npm run db:deploy
npm run build
npm run start
```

Run migrations only against the intended environment and back up production data before schema changes.
