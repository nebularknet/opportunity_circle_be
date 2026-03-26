# Opportunity Circle Backend Feature Audit

Date: 2026-03-24

## Scope Reviewed
- API routes, controllers, services, middleware, models, cron jobs, and test suite.
- Runtime checks run locally: `npm test`, TODO/FIXME scan, route consistency scan.

## Implemented Features (Working in code structure)
1. **Role-based auth and session flows**
   - Register/login/logout/refresh token/password reset/email verification/user role update.
   - OAuth adapters for Google + GitHub exist.
2. **Marketplace core**
   - Opportunities CRUD with moderation states and status filtering.
   - Applications submission/review/withdraw flow.
   - Saved items (resource/opportunity) for seekers.
3. **User domains**
   - Seeker profile + preferences + onboarding.
   - Publisher profile + onboarding + dashboard analytics.
   - Admin moderation, user management, and publisher verification controls.
4. **Content + engagement**
   - CMS page fetch/update, resources CRUD, mentor directory and workshop linking.
   - Notification persistence + socket push path.
5. **Operational protections**
   - Helmet/CORS/rate-limit/XSS sanitize/NoSQL sanitize/correlation-id middleware.
   - Cron jobs for weekly digest and opportunity expiration.

## Incomplete / Broken / Missing Features

### P0 (blocking correctness)
1. **API version mismatch (`/api` vs `/api/v1`)**
   - App mounts all routes under `/api/*`, but swagger comments, tests, and OAuth callback config use `/api/v1/*`.
   - This breaks existing tests, docs accuracy, and OAuth callback URLs unless reverse-proxy rewrites are present.

2. **OAuth success error path references undefined symbols**
   - `oauthSuccess` catch block references `logger` and `AuthErrors` without imports.
   - If the try block throws, catch path itself can throw `ReferenceError`.

3. **Test runner currently broken by missing dependency**
   - `npm test` fails immediately: `Cannot find package 'autocannon'` from `tests/performance/load.test.js`.
   - This prevents full confidence validation from CI/local test command.

### P1 (feature incomplete)
4. **Notification flow for application status updates is TODO**
   - Service updates status but seeker notification is not implemented.

5. **Admin rejection reason handling is TODO**
   - Admin moderation endpoint accepts `reason` but does not send rejection notifications.

6. **Weekly digest template missing**
   - Weekly digest service uses template `weekly-digest`, but template file is absent from `src/views`.

### P2 (docs/devex gaps)
7. **README points to missing docs file**
   - README references `docs/API_ENDPOINTS.md`, but no `docs` directory exists.

8. **Swagger JSON route expected by tests is not exposed**
   - Tests look for `/api-docs.json`, but only `/api-docs` route is mounted.

9. **Startup env var strictness may block non-OAuth environments**
   - Server exits if OAuth env vars are missing, even when OAuth auth is not needed for local API work.

## Validation Commands and Findings
1. `npm test` -> **failed** due to missing `autocannon` package import in performance test.
2. `rg -n "TODO|FIXME|TBD|Not Implemented" src tests README.md` -> found unresolved TODOs in admin/application flows.
3. `rg -n "/api/v1" src tests README.md` -> widespread `/api/v1` usage in tests/docs/config not matching app router mounts.

## Recommended Completion Plan

### Phase 1 (stabilize runtime and tests)
1. Align API paths (either mount `/api/v1` aliases or migrate docs/tests/config to `/api`).
2. Fix `oauthSuccess` imports for robust catch handling.
3. Repair `npm test` entrypoint:
   - either add `autocannon` dev dependency, or
   - move performance test out of default test glob.

### Phase 2 (finish incomplete feature logic)
4. Implement seeker notifications for application status changes.
5. Implement publisher notification on admin rejection with reason payload.
6. Add missing `weekly-digest.hbs` template and test it.

### Phase 3 (documentation and observability)
7. Add/restore `docs/API_ENDPOINTS.md` and sync with actual route prefixes.
8. Optionally expose `/api-docs.json` for tooling/tests.
9. Relax hard startup env checks to only require OAuth vars when OAuth routes are enabled.

## Definition of Done for "feature complete"
- `npm test` green on clean install.
- All documented endpoints resolve under the documented prefix.
- OAuth callback URLs match mounted routes.
- No TODO markers in core business flows (applications/admin moderation).
- Weekly digest runs with a valid template and sends successfully in test mode.
