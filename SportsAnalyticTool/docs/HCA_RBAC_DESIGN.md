# HCA Analytics RBAC Design

## Decision

Use application-level role-based access control with stable permission names. Authentication is intentionally disabled for the local pilot. The request-context adapter currently accepts `X-Dev-Role`; a future identity provider will replace that adapter with validated claims.

The authorization policy must not depend on UI visibility. Every protected API route enforces its permission on the server.

## Roles

| Role | Intended user | Permissions |
| --- | --- | --- |
| Viewer | Read-only stakeholder | `read:overview`, `read:players`, `read:teams` |
| Analyst | Performance analyst | Viewer plus `read:quality` |
| Coach | Coaching/planning user | Overview, players, teams, and `read:player-detail` |
| Data Engineer | Data operations user | Overview and `read:quality` |
| Administrator | Local pilot operator | All current read permissions |

Permissions are intentionally fine-grained. Roles are bundles that can change without rewriting route handlers.

## Request Flow

```text
Local browser role selector
  -> X-Dev-Role header
  -> rbac.context(request)
  -> route permission middleware
  -> read-only SQLite query
  -> response
```

No client-side role check is trusted for security. The client hides unavailable navigation to improve usability; the server remains authoritative.

## Local Test Matrix

| Endpoint | Viewer | Analyst | Coach | Data Engineer | Admin |
| --- | --- | --- | --- | --- | --- |
| `/api/session` | 200 | 200 | 200 | 200 | 200 |
| `/api/options` | 200 | 200 | 200 | 200 | 200 |
| `/api/summary` | 200 | 200 | 200 | 200 | 200 |
| `/api/players` | 200 | 200 | 200 | 403 | 200 |
| `/api/teams` | 200 | 200 | 200 | 403 | 200 |
| `/api/quality` | 403 | 200 | 403 | 200 | 200 |
| `/api/players/:playerId` | 403 | 403 | 200 | 403 | 200 |

## Authentication Integration Later

When authentication is introduced:

1. Validate the access token signature, issuer, audience, expiry, and nonce using the selected identity provider.
2. Map provider groups or claims to one or more approved application roles.
3. Reject unknown or unapproved roles; never fall back silently to a privileged role.
4. Pass the validated principal to the authorization context adapter.
5. Preserve route permission names and middleware.
6. Add user ID, role, route, decision, dataset version, and request ID to an audit event.
7. Remove or disable `X-Dev-Role` outside local development.

The current `X-Dev-Role` mechanism is not authentication and must not be used on a shared or production deployment.

## Future Resource-Level Authorization

The current prototype authorizes feature access, not individual resources. Before adding private scouting notes, medical information, or team-specific operational data, add resource policies such as:

- Analyst can read approved competition data.
- Coach can read assigned team/player planning data.
- Data Engineer can operate source pipelines but cannot read confidential coaching notes.
- Administrator can manage configuration but all access remains audited.

Resource filters should be applied in SQL or a repository layer, not after fetching unrestricted rows.

## Design Principles

- **Deny by default:** new routes require an explicit permission.
- **Least privilege:** role permissions are limited to the current workflow.
- **Server authority:** UI state never grants access.
- **Stable policy surface:** identity integration changes the principal adapter, not business routes.
- **Auditable decisions:** authorization and analyst recommendations are separate records.
- **Local transparency:** role and authentication mode are visible in the UI.

## Verification Commands

Start the local server, then run:

```powershell
$headers = @{ 'X-Dev-Role' = 'viewer' }
Invoke-RestMethod http://localhost:3000/api/session -Headers $headers
Invoke-WebRequest -UseBasicParsing http://localhost:3000/api/quality -Headers $headers
```

The session request should return the Viewer permissions. The quality request should return HTTP `403`.
