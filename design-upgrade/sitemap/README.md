# GTOP sitemap — current application

Source: `058729a6fc62d285d5f7abc6d603952466df54d9`. The current product is `gtop-app/`; `gtop-v2/` and standalone developer fixture applications are outside this baseline.

**39 distinct URL patterns · 40 route entries.** `/quiz` has two ordered matches: invitation practice and ordinary practice. The wildcard redirects to `/` rather than rendering a separate not-found page.

Open the [desktop/mobile gallery](gallery.md), [coverage data](coverage.json) and [capture method, review and limits](../evidence/baseline/README.md). Route coverage records actual rendered URLs; an attempted URL that redirects is not counted as a capture of that route.

| ID | URL pattern | Access | Screen / variant |
|---|---|---|---|
| R01 | `/practice` | public | PracticeInvite |
| R02 | `/quiz` | user, admin | Invited five-question practice |
| R03 | `/admin/question-papers/legacy` | admin | QuestionPapers |
| R04 | `/admin/question-papers/view/:paperId` | admin | PaperChatViewer |
| R05 | `/admin/question-papers/all` | admin | PaperChat |
| R06 | `/admin/question-papers/new` | admin | PaperChat |
| R07 | `/admin/question-papers` | admin | PaperChat |
| R08 | `/admin/question-papers/chat/:conversationId` | admin | PaperChat |
| R09 | `/admin/question-library` | admin | QuestionLibrary |
| R10 | `/admin/question-bank` | admin | QuestionBankWorkspace |
| R11 | `/admin/question-paper-generator` | admin | QuestionPaperGenerator |
| R12 | `/admin/question-review` | admin | QuestionReviewWorkbench |
| R13 | `/learning-lab` | authenticated | Learning Lab index |
| R14 | `/learning-lab/plants` | authenticated | Plant Reproduction interactive lab |
| R15 | `/learning-lab/plants/results` | admin | Plant Reproduction admin results |
| R16 | `/learning-lab/current` | authenticated | Current Lab — Electricity interactive lab |
| R17 | `/learning-lab/results` | admin | Current Lab admin results |
| R18 | `/` | public | Public landing |
| R19 | `/profile-setup` | public | Profile setup / missing curriculum |
| R20 | `/profile` | user, admin | Learner profile (also allowed admin) |
| R21 | `/dashboard` | user, admin | Learner home (also allowed admin) |
| R22 | `/admin` | admin | AdminDashboard |
| R23 | `/admin/action-plan` | admin | ActionPlan |
| R24 | `/admin/mcq-management` | admin | McqManagement |
| R25 | `/admin/add-mcq` | admin | AddMcq |
| R26 | `/admin/manage-syllabus` | admin | ManageSyllabus |
| R27 | `/syllabus-preview` | admin | SyllabusPreview |
| R28 | `/logs` | admin | Logs |
| R29 | `/quiz` | user, admin | Standard/quick MCQ quiz · ordinary practice |
| R30 | `/quiz-summary` | user, admin | Quiz result |
| R31 | `/quiz-run` | user, admin | Collaborative Quiz Runs |
| R32 | `/quiz-run/lobby/:sessionId` | user, admin | Quiz Run lobby |
| R33 | `/live` | user, admin | Live Quiz entry |
| R34 | `/live/host/:sessionId` | user, admin | Host console |
| R35 | `/live/play/:sessionId` | user, admin | Participant lobby/player |
| R36 | `/live/summary/:sessionId` | user, admin | Live results |
| R37 | `/reports` | user, admin | Learner reports |
| R38 | `/admin/manage-syllabus/edit` | admin | EditSyllabus |
| R39 | `/admin/user-list` | admin | UserList |
| R40 | `/dev/ui` | admin | UiKitchen |

## Navigation and alternate entry points

- The public landing page leads to sign-in/profile setup; `/practice` also accepts invitation URLs.
- The learner sidebar links Dashboard, Quick Quiz, Learning Lab, Live Quizzes and Progress. Quiz Runs are available through the dashboard.
- The admin sidebar adds action plans, questions and papers, syllabus management/review, user management, the separate Admin Console, UI preview and logs.
- `/admin/question-papers`, `/all`, `/new` and `/chat/:conversationId` share the same component with different modes. `/view/:paperId` is a distinct document viewer.
- `/admin/question-papers/legacy` is still directly routable; it is not present in the current primary navigation.
- The older MCQ manager and syllabus editor are entered through syllabus-management controls.
- The profile menu and responsive navigation drawer, Custom Quiz dialog, paper editors, review confirmation, lab stages and other in-page states are indexed separately in the capture gallery.

## Capture contract

Both 1440 × 1000 desktop and 390 × 844 mobile Chromium viewports are required for each applicable state. Capture originals retain their real page dimensions; a full-page image may be taller than the viewport. Authenticated screens use controlled emulator data, and the public landing page is also captured from the live release.

State coverage groups meaningful layouts and decisions. Dropdown values, random question permutations and every combination of record data are not separate screens. Transient OS/browser UI (Google account chooser, print dialog, installation permission prompts) is outside the application screenshot baseline. This is a visual inventory, not a cross-browser/physical-device certification.

See [coverage.json](coverage.json) and the [baseline gallery](gallery.md) for verified evidence; the [review report](../evidence/baseline/review.md) records state-level gaps and capture corrections.
