# GTOP Firestore MCP

This service gives authorized agents direct, persistent access to GTOP Firestore.
The request path is the agent's installed connector → Cloud Run → Firestore.
GitHub Actions builds and deploys the server; database requests do not run through Actions.

## Hosted connection

- MCP URL: `https://gtop-firestore-mcp-78765581239.us-central1.run.app/mcp`
- Transport: stateless Streamable HTTP, JSON responses.
- Authentication: OAuth authorization code with S256 PKCE and rotating refresh tokens.
- OAuth scope: `gtop:admin`.
- Identity: verified Firebase Google sign-in, an explicitly allowed email, and `users/{uid}.role == 'admin'`.
- Default allowed owner: `schttewary@gmail.com` (deployment configuration).
- Cloud Run service: `gtop-firestore-mcp`, project `gtop-app`, region `us-central1`.

Create a ChatGPT custom connector named **GTOP Firestore**, select OAuth, and use
that URL. Discovery and dynamic client registration supply the remaining settings.
Authorize with the existing GTOP administrator Google account. The installed
connection is retained across conversations; new agents use the connector tools
when it is available in their session. Other accounts and agent applications must
be separately authorized. The service does not automatically grant unrelated agents
or users access.

Access tokens last one hour. Refresh tokens rotate after use; connections currently
have a 90-day maximum lifetime. Reconnect after expiry or revocation. Removing the
admin role, removing the email from the allowlist, disabling the Firebase account,
or revoking Firebase refresh tokens prevents subsequent MCP requests. `/revoke`
revokes the entire MCP session. API keys and service-account JSON are never handed
to an agent or placed in the connector configuration.

## Tools and operating procedure

The 15 tools cover Action Plan coordination, application versions, bounded queries,
collection discovery, document reads/creates/updates/deletes, batches and transactions.

1. Read the relevant records before changing them.
2. Use each document's returned `updateToken` as its write precondition.
3. Attach the task/branch/PR reference when updating the Action Plan.
4. Read affected documents again after mutation and check the resulting values.
5. Deletion requires the exact `DELETE <document-path>` confirmation.

Generic tools accept JSON fields. Firestore-specific transforms and domain-specific
invariants are not automatically inferred. For example, question edits may also
require syllabus counts to be updated. Use the repository's product logic and
transactions for related changes. Queries return at most 200 documents; each batch
or transaction accepts at most 20 writes. Larger jobs must be explicitly chunked.

All existing write tools record audit events in `mcpAuditLog`, with the authenticated
user and OAuth client as actor for HTTP requests. Auditing is inherited from the
original MCP: an audit failure after a successful data write can still return an
error. Read back the document before retrying a failed write.

## Authentication storage and access

OAuth clients, pending consent, one-use authorization codes, access/refresh grants,
replay markers and sessions are stored under `_gtopMcpAuth/{kind}/items/{hash}`.
Codes and bearer tokens are indexed by SHA-256; their raw values are not stored.
The MCP cannot query or mutate that namespace, and deployed Firestore Security
Rules must deny Firebase client access. Server access uses IAM and ADC.

Refresh rotation and code consumption are Firestore transactions. OAuth grants
survive process restarts, new revisions, and scaling. Each HTTP request has its own
MCP server instance and authenticated actor. Expired records are rejected even if
retained in storage. Expired-record cleanup/Firestore TTL can be added independently;
expiry enforcement does not depend on cleanup.

The runtime reuses the existing GTOP Cloud Run identity,
`78765581239-compute@developer.gserviceaccount.com`, and the existing `gcf-artifacts`
container repository. Creating a dedicated runtime identity requires an IAM owner;
the deployment identity currently cannot create service accounts or assign project
roles. The legacy Cloud Functions service `gtopmcp` is a separate API-key service.

## Development and deployment

```sh
cd tools/gtop-mcp
npm ci
npm run build
npm test
npm start            # existing local stdio transport, using local ADC
npm run start:http   # hosted transport; requires configuration below
```

Required HTTP environment:

- `GTOP_MCP_PUBLIC_URL`: canonical HTTPS origin, without trailing slash or path.
- `GTOP_MCP_ADMIN_EMAILS`: comma-separated permitted administrator emails.
- `GTOP_FIREBASE_PROJECT_ID`: `gtop-app`.
- `PORT`: defaults to 8080.
- `GTOP_MCP_REDIRECT_ORIGINS`: defaults to `https://chatgpt.com,https://chat.openai.com`.
  Add an independently trusted client's exact origin when onboarding another agent
  application. Do not use wildcard redirect domains.

`.github/workflows/gtop-hosted-mcp.yml` runs tests, builds a versioned container,
validates live Firestore rules, pushes the image, deploys Cloud Run, preserves and
extends Firebase authorized domains, and verifies discovery plus unauthenticated
request rejection. It uses the existing `firebase-live-backend` environment secret
`FIREBASE_SERVICE_ACCOUNT` only within the deployment runner. Cloud Run uses ADC.

Run `npm test` for OAuth and MCP transport security coverage. Deployment checks
verify the public service and auth boundary. A complete acceptance check additionally
requires connecting a real admin account, then creating, reading, updating and
deleting a disposable document through the installed connector and checking audit
records. Do not equate a successful unauthenticated health check with successful
Firestore access.
