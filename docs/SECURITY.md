# Carrlo Security Notes

- Dashboard middleware performs a lightweight session-cookie redirect. Server components and services still resolve and verify the Auth.js session and active organization membership before returning tenant data.
- Credentials auth uses hashed passwords through `bcryptjs`.
- Login attempts are rate-limited in memory for development. Production should use a durable shared rate limiter.
- Server services resolve tenant context from the authenticated session and active membership.
- RBAC is centralized in `src/lib/permissions.ts`.
- Private document metadata is modeled. File bytes and production S3-compatible storage are not yet implemented.
- Do not commit real secrets. Use `.env` locally and managed secret storage in production.
