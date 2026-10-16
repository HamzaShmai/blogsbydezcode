# Security model

## Auth

- Auth.js JWT sessions, **httpOnly** cookies, `sameSite=lax`, `secure` on HTTPS
- Session max age: 8 hours
- Passwords hashed with bcrypt (cost 12 on invite accept)
- Failed logins audited without storing passwords
- Timing-safe-ish login path (dummy compare when user missing)
- Production refuses weak/missing `NEXTAUTH_SECRET` and `CREDENTIALS_ENCRYPTION_KEY`

## Authorization

- Middleware requires a valid JWT for `/agency`, `/client`, and most `/api/*`
- Portal role gate: clients cannot open `/agency`
- Every website/article API checks `canAccessWebsite` / `canWriteWebsite`
- Emergency stop: **AGENCY_ADMIN only**
- Job worker/schedule: **QStash signature required in production** (no open endpoints)

## Data leak prevention

- `sanitizeForClient()` strips `credentialsEnc`, `gscTokensEnc`, `passwordHash`, tokens, and `*Secret` / `*Enc` / `*Hash` fields from **all** JSON API responses
- Prisma queries use `select` so nested `website: true` never returns CMS ciphertext
- No `NEXT_PUBLIC_*` variables for secrets — AI keys, DB URL, encryption keys stay server-only
- Audit logs are org-scoped for agency admins

## Credentials at rest

- CMS + GSC tokens encrypted with AES-256-GCM (`CREDENTIALS_ENCRYPTION_KEY`)
- Decryption only inside server-side publish / GSC / test-connection services

## Password policy (invite accept)

Minimum 12 characters with upper, lower, number, and symbol.
