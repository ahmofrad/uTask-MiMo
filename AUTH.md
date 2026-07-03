# AUTH.md — Authentication Integration Guide

> How local accounts, LDAP, and SAML SSO fit together. Read this before implementing Phase 2.

---

## 1. Goals

- **One user, one profile.** A user has many `AuthIdentity` rows (one per provider). Identity linking happens at login time.
- **Switchable per organization.** Owner chooses which providers are enabled. In a future multi-tenant world this becomes per-tenant, but for V1 we assume a single install.
- **Just-In-Time provisioning.** LDAP / SAML users are created on first successful auth.
- **Session revocable.** Owner can force-logout-everywhere for any user.
- **Auditable.** Every login, logout, and identity-link is written to `auditlog`.

---

## 2. Provider Matrix

| Provider | Identifier | Verification | User creation |
|----------|-----------|--------------|---------------|
| **Local** | email | bcrypt password | Manual invitation by Admin/Owner |
| **LDAP** | `providerSubject = DN` | LDAP bind with user credentials | JIT on first login |
| **SAML** | `NameID` from assertion | SAML signature + audience checks | JIT on first login |

---

## 3. Auth.js v5 Configuration

Auth.js v5 (NextAuth) is the framework. Three providers registered:

```ts
// src/lib/auth/config.ts (sketch)
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { LdapProvider } from "./providers/ldap";
import { SamlProvider } from "./providers/saml";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import bcrypt from "bcrypt";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },        // see §6 for why JWT-cookie-sessionid combo
  providers: [
    Credentials({
      name: "Local",
      credentials: { email: {}, password: {} },
      authorize: async (creds) => { /* bcrypt verify */ },
    }),
    LdapProvider,                       // see §4
    SamlProvider,                       // see §5
  ],
  callbacks: {
    signIn: async ({ user, account, profile }) => {
      // 1. Look up AuthIdentity by (provider, providerSubject).
      // 2. If exists → link to existing user by userId, return true.
      // 3. If not → JIT-create user + identity (LDAP/SAML only), return true.
      // 4. If account is locked/suspended → return false.
    },
    session: async ({ session, token }) => {
      // Inject userId, role, locale, accent into session.
    },
  },
  pages: {
    signIn: "/login",
  },
});
```

**Important:** the Auth.js Prisma adapter creates rows for `User`, `Account`, `Session`, `VerificationToken`. We extend this with our own `AuthIdentity` model for the multi-provider linking (the adapter's `Account` table has its own shape that doesn't fit cleanly).

---

## 4. LDAP Provider

### 4.1 Library

`ldapts` — promise-based, well-maintained, supports StartTLS and LDAPS.

### 4.2 Configuration (per organization)

Stored in `Settings` table, scope=`install`, encrypted at rest with a key from env:

```json
{
  "ldap": {
    "enabled": true,
    "url": "ldaps://ldap.corp.example.com:636",
    "bindDn": "cn=svc-taskapp,ou=service,dc=corp,dc=example,dc=com",
    "bindPassword": "***",
    "searchBase": "ou=people,dc=corp,dc=example,dc=com",
    "searchFilter": "(&(objectClass=person)(uid={{username}}))",
    "usernameAttribute": "uid",
    "emailAttribute": "mail",
    "nameAttribute": "cn",
    "groupSearchBase": "ou=groups,dc=corp,dc=example,dc=com",
    "groupSearchFilter": "(member={{dn}})",
    "defaultRole": "member",
    "adminGroupDn": "cn=taskapp-admins,ou=groups,...",
    "syncIntervalMinutes": 60,
    "tlsCaCert": "-----BEGIN CERTIFICATE-----..."
  }
}
```

### 4.3 Flow

1. User submits username + password to `/api/v1/auth/ldap/start`.
2. Server creates an `ldapts` client with the configured URL.
3. Search for the user DN by `(uid={{username}})`.
4. Bind as that DN with the user's submitted password.
5. On success: load email + display name from the entry.
6. Upsert `AuthIdentity(provider='ldap', providerSubject=dn, ...)`.
7. Find or create `User` by email (link if exists).
8. Create a session, set cookie, return success.

### 4.4 Group sync (periodic job)

A BullMQ cron job (every 60 min by default) re-syncs groups:

- For each group in `groupSearchBase`, list members.
- Map each member's DN to a local `User`.
- Assign role per `adminGroupDn` mapping:
  - In `adminGroupDn` → role `admin` (org-scoped).
  - Not in any mapped group → role `defaultRole`.

### 4.5 Failure handling

- LDAP unreachable → return generic "auth unavailable" to user; log full error; alert via Prometheus + Alertmanager.
- Bind failed (wrong password) → 401; audit log entry `action='login_failed', provider='ldap'`.
- User suspended locally → reject even if LDAP bind succeeds.

### 4.6 Testing

- Use `ldapts` mock or a Testcontainers OpenLDAP image for integration tests.
- E2E: spin up local OpenLDAP container, configure, log in, assert user created.

---

## 5. SAML Provider

### 5.1 Library

`@node-saml/node-saml` — successor to `passport-saml`, maintained, supports modern SAML features.

### 5.2 Configuration (per organization)

Stored in `Settings` table, scope=`install`:

```json
{
  "saml": {
    "enabled": true,
    "entityId": "https://taskapp.corp.example.com/saml/metadata",
    "acsUrl": "https://taskapp.corp.example.com/api/v1/auth/saml/callback",
    "sloUrl": "https://taskapp.corp.example.com/api/v1/auth/saml/slo",
    "idpMetadataUrl": "https://login.microsoftonline.com/.../federationmetadata",
    "idpEntityId": "https://sts.windows.net/...",
    "idpSsoUrl": "https://login.microsoftonline.com/.../saml2",
    "idpCertificate": "-----BEGIN CERTIFICATE-----...",
    "nameIdFormat": "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    "attributeMap": {
      "email": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
      "displayName": "http://schemas.microsoft.com/identity/claims/displayname",
      "role": "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
    },
    "defaultRole": "member",
    "adminRoleValue": "TaskApp.Admin",
    "wantAssertionsSigned": true,
    "wantResponseSigned": true,
    "signatureAlgorithm": "sha256",
    "digestAlgorithm": "sha256"
  }
}
```

### 5.3 Flow

1. User clicks "Sign in with SSO" on `/login`.
2. Redirect to `/api/v1/auth/saml/start?orgSlug=...` → returns SAML AuthnRequest redirect to IdP SSO URL.
3. IdP authenticates user, posts SAMLResponse to `/api/v1/auth/saml/callback`.
4. Server validates signature, audience, timestamps, replay.
5. Extract NameID + attributes per `attributeMap`.
6. Upsert `AuthIdentity(provider='saml', providerSubject=NameID, providerIssuer=idpEntityId, ...)`.
7. Find or create `User` by email (link if exists).
8. Create session, redirect to app.

### 5.4 SP-initiated vs IdP-initiated

- **SP-initiated** (user starts at our app): supported out of the box.
- **IdP-initiated** (user starts at IdP app launcher): supported via Unsolicited Response handler. Log warning — IdP-initiated is discouraged but commonly needed for app launchers.

### 5.5 Single Logout (SLO)

Support SAML SLO so logout propagates to IdP (logout from IdP = logout from us, and vice versa). Optional but expected by enterprise customers.

### 5.6 Failure handling

- Signature invalid → reject, audit `action='login_failed', provider='saml', reason='invalid_signature'`.
- Assertion expired (clock skew > 5 min) → reject, log clock skew metric.
- Audience mismatch → reject (likely misconfiguration; alert admin).
- User suspended locally → reject even if assertion valid.

### 5.7 Testing

- Mock IdP in unit tests.
- E2E: spin up SimpleSAMLphp container via Testcontainers, configure, log in.

---

## 6. Session Strategy

**Why a hybrid:** Auth.js v5's Prisma adapter supports DB sessions, but for 10k concurrent users we need:
- Stateless verification on the hot path (no DB hit per request).
- Server-side revocation (so "logout everywhere" works).

**Approach:**

1. On login, create:
   - **JWT** (signed, httpOnly cookie) containing `sessionId` + `userId` + `role` + `locale` + `accent`.
   - **Session record** in Redis: `session:<sessionId>` → `{ userId, createdAt, lastUsedAt, ip, userAgent, revoked: false }` with TTL 12 h.
2. Every request: verify JWT signature (stateless), then `GET session:<sessionId>` from Redis. If `revoked=true` or missing → 401.
3. Sliding expiration: every request updates `lastUsedAt` and resets TTL.
4. Logout-everywhere: set `revoked=true` on all `session:<userId>:*` keys (use `SCAN` to find them).
5. Idle timeout: 30 min. Absolute timeout: 12 h.

**Session security:**
- `httpOnly`, `secure`, `sameSite=lax` cookies.
- `__Host-` prefix on session cookie.
- `Secure` flag required; HSTS preload.
- CSRF token in separate cookie (double-submit).

---

## 7. Identity Linking Rules

When a user authenticates with a provider:

1. **Look up `AuthIdentity`** by `(provider, providerSubject)`.
   - **Found:** session created for the linked `User`.
2. **Not found. Look up `User`** by email (case-insensitive).
   - **Found:** create new `AuthIdentity` linked to that user. Audit `action='identity_linked', provider=...`.
   - **Not found (LDAP/SAML only):** JIT-create `User` + `AuthIdentity`. Audit `action='user_jit_created', provider=...`.
   - **Not found (Local only):** reject — local users must be invited by Admin.
3. **Conflict resolution:** if email exists but local user is suspended → reject login.

**Edge cases:**
- Admin disables a provider mid-session → existing sessions for that provider are revoked; user must re-auth via another provider.
- LDAP bind succeeds but our local user is suspended → reject.

---

## 8. Admin Configuration UI

Admin pages under `/admin`:

- **LDAP settings:** form with all fields; "Test connection" button performs a bind and reports success/failure.
- **SAML settings:** form with all fields; "Upload IdP metadata XML" auto-fills fields; "Test login" button performs a metadata fetch + dry-run assertion parse.
- **Local auth:** toggle on/off; if off, only SSO allowed.
- **Password policy:** min length, complexity, expiry days.
- **Session settings:** idle timeout, absolute timeout, max concurrent sessions per user.

All settings changes audited.

---

## 9. Audit Events

Every auth event writes to `auditlog`:

| Event | actorUserId | action | metadata |
|-------|------------|--------|----------|
| Local login success | user.id | `login_success` | `{ provider: 'local' }` |
| Local login failed | null | `login_failed` | `{ provider: 'local', email, reason }` |
| LDAP login success | user.id | `login_success` | `{ provider: 'ldap', dn }` |
| LDAP login failed | null | `login_failed` | `{ provider: 'ldap', username, reason }` |
| SAML login success | user.id | `login_success` | `{ provider: 'saml', nameId, idp }` |
| SAML login failed | null | `login_failed` | `{ provider: 'saml', reason }` |
| Logout | user.id | `logout` | `{ sessionId }` |
| Force logout (admin) | admin.id | `force_logout` | `{ targetUserId }` |
| Identity linked | user.id | `identity_linked` | `{ provider }` |
| User JIT-created | null | `user_jit_created` | `{ provider, email }` |
| Password changed | user.id | `password_changed` | `{}` |
| Password reset requested | null | `password_reset_requested` | `{ email }` |
| SAML config changed | admin.id | `saml_config_changed` | `{ changes }` |
| LDAP config changed | admin.id | `ldap_config_changed` | `{ changes }` |

---

## 10. Failure Modes to Test

- [ ] LDAP server unreachable.
- [ ] LDAP bind with wrong password.
- [ ] LDAP user in disabled state.
- [ ] SAML signature invalid.
- [ ] SAML assertion expired.
- [ ] SAML audience mismatch.
- [ ] SAML replay (same assertion twice).
- [ ] Local user with suspended status tries to log in.
- [ ] Admin disables a provider while users are logged in via it.
- [ ] Session cookie tampered.
- [ ] Session record deleted from Redis (TTL expired) but cookie still present.
- [ ] Identity linking across providers for the same email.

---

## 11. Security Checklist

- [ ] No password ever logged, even at debug.
- [ ] SAML assertions validated for: signature, audience, recipient, NotBefore, NotOnOrAfter, replay (one-time use via Redis set).
- [ ] LDAP bind uses service account with read-only privileges in production.
- [ ] LDAP TLS verified against configured CA cert.
- [ ] All auth endpoints rate-limited (10 req/min/IP).
- [ ] All auth endpoints audited.
- [ ] No user enumeration via login errors (return generic "invalid credentials" for both bad email and bad password in local mode; LDAP mode must distinguish for UX but log only).
- [ ] Magic-link tokens are single-use, 15-min expiry, tied to user-agent fingerprint.
- [ ] Password reset links single-use, 1-h expiry.
- [ ] bcrypt cost ≥ 12; argon2id acceptable alternative.
- [ ] No password hints stored.