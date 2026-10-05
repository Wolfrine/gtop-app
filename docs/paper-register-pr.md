Older requirements and completed papers were difficult to recover, and the saved viewer could retain a privileged answer after admin access changed. This change gives each paper family a durable register and keeps its current action, original requests and immutable outputs together.

- Adds bounded historical retrieval, resumable verified backfill, current-admin cache boundaries and preserved return context.
- Keeps separate question-paper and answer-key copies, adds truthful saved ID/version context to viewing and printing, and clears output on role/account changes.
- Corrects worker ISO timestamp ordering and initializes the Firebase runtime project required by background triggers.
- Retains canonical source records, admin-wide permissions, scheduled generation and existing direct links.

Verified: production build; 24 desktop/320px browser tests; 27 actual production journeys; production and delayed-read authorization checks; module/backend/rules suites; and register/gateway/publication integrations. Final visual evidence, independent judgments and exact hashes are under `design/paper-register/round-5/`. The earlier 10,023-family scale run is retained with its original hash and a narrow documented carry-forward.

Release requires protected backend deployment and ready backfill before hosting, followed by CI artifact comparison and hosted verification. CI writes fresh `version.json` metadata. Agent review is not owner approval.
