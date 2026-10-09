# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: readiness-states.spec.ts >> readiness busy paper register has a bounded first page and older records
- Location: e2e/readiness-states.spec.ts:8:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: 'Load older papers', exact: true })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('button', { name: 'Load older papers', exact: true }) with timeout 5000ms
  - waiting for getByRole('button', { name: 'Load older papers', exact: true })

```

```yaml
- button "Toggle navigation"
- text: GTOP
- navigation "Paper workspace":
  - link "Question papers":
    - /url: /admin/question-papers?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
  - group: Updates
  - link "Bank tools":
    - /url: /admin/question-library?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
- main:
  - heading "Papers" [level=1]
  - paragraph: Requests and completed papers, together.
  - link "+ New paper":
    - /url: /admin/question-papers/new?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
  - paragraph:
    - text: "Next scheduled opportunity:"
    - strong: 8 Oct 2026, 4:00 pm IST
  - navigation "Paper views":
    - button "All papers" [pressed]
    - button "Needs action"
    - button "In progress"
    - button "Ready"
  - text: Search all papers
  - textbox "Search all papers":
    - /placeholder: Search title, subject, request words or ID
  - button "Search"
  - checkbox "Created by me" [checked]
  - text: Created by me Updated most recently
  - region "Paper register":
    - article:
      - link "Readiness 001 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-0?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…mj2wf7-0 · Created by Readiness Admin Queued Next opportunity 8 Oct 2026, 4:28 pm IST
      - link "View status":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-0?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 8 Oct 2026, 3:28 pm IST
    - article:
      - link "Readiness 002 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-1?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…mj2wf7-1 · Created by Readiness Admin Needs your reply
      - link "Reply":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-1?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 8 Oct 2026, 2:28 pm IST
    - article:
      - link "Readiness 003 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-2?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…mj2wf7-2 · Created by Readiness Admin Needs attention Open the issue and send a correction
      - link "Review issue":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-2?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 8 Oct 2026, 1:28 pm IST
    - article:
      - link "Readiness 004 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-3?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…mj2wf7-3 · Created by Readiness Admin Queued Next opportunity 8 Oct 2026, 4:28 pm IST
      - link "View status":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-3?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 8 Oct 2026, 12:28 pm IST
    - article:
      - link "Readiness 005 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-4?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…mj2wf7-4 · Created by Readiness Admin Needs your reply
      - link "Reply":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-4?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 8 Oct 2026, 11:28 am IST
    - article:
      - link "Readiness 006 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-5?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…mj2wf7-5 · Created by Readiness Admin Needs attention Open the issue and send a correction
      - link "Review issue":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-5?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 8 Oct 2026, 10:28 am IST
    - article:
      - link "Readiness 007 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-6?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…mj2wf7-6 · Created by Readiness Admin Queued Next opportunity 8 Oct 2026, 4:28 pm IST
      - link "View status":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-6?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 8 Oct 2026, 9:28 am IST
    - article:
      - link "Readiness 008 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-7?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…mj2wf7-7 · Created by Readiness Admin Needs your reply
      - link "Reply":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-7?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 8 Oct 2026, 8:28 am IST
    - article:
      - link "Readiness 009 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-8?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…mj2wf7-8 · Created by Readiness Admin Needs attention Open the issue and send a correction
      - link "Review issue":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-8?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 8 Oct 2026, 7:28 am IST
    - article:
      - link "Readiness 010 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-9?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…mj2wf7-9 · Created by Readiness Admin Queued Next opportunity 8 Oct 2026, 4:28 pm IST
      - link "View status":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-9?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 8 Oct 2026, 6:28 am IST
    - article:
      - link "Readiness 011 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-10?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…j2wf7-10 · Created by Readiness Admin Needs your reply
      - link "Reply":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-10?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 8 Oct 2026, 5:28 am IST
    - article:
      - link "Readiness 012 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-11?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…j2wf7-11 · Created by Readiness Admin Needs attention Open the issue and send a correction
      - link "Review issue":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-11?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 8 Oct 2026, 4:28 am IST
    - article:
      - link "Readiness 013 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-12?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…j2wf7-12 · Created by Readiness Admin Queued Next opportunity 8 Oct 2026, 4:28 pm IST
      - link "View status":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-12?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 8 Oct 2026, 3:28 am IST
    - article:
      - link "Readiness 014 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-13?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…j2wf7-13 · Created by Readiness Admin Needs your reply
      - link "Reply":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-13?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 8 Oct 2026, 2:28 am IST
    - article:
      - link "Readiness 015 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-14?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…j2wf7-14 · Created by Readiness Admin Needs attention Open the issue and send a correction
      - link "Review issue":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-14?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 8 Oct 2026, 1:28 am IST
    - article:
      - link "Readiness 016 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-15?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…j2wf7-15 · Created by Readiness Admin Queued Next opportunity 8 Oct 2026, 4:28 pm IST
      - link "View status":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-15?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 8 Oct 2026, 12:28 am IST
    - article:
      - link "Readiness 017 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-16?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…j2wf7-16 · Created by Readiness Admin Needs your reply
      - link "Reply":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-16?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 7 Oct 2026, 11:28 pm IST
    - article:
      - link "Readiness 018 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-17?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…j2wf7-17 · Created by Readiness Admin Needs attention Open the issue and send a correction
      - link "Review issue":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-17?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 7 Oct 2026, 10:28 pm IST
    - article:
      - link "Readiness 019 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-18?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…j2wf7-18 · Created by Readiness Admin Queued Next opportunity 8 Oct 2026, 4:28 pm IST
      - link "View status":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-18?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 7 Oct 2026, 9:28 pm IST
    - article:
      - link "Readiness 020 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-19?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…j2wf7-19 · Created by Readiness Admin Needs your reply
      - link "Reply":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-19?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 7 Oct 2026, 8:28 pm IST
    - article:
      - link "Readiness 021 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-20?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…j2wf7-20 · Created by Readiness Admin Needs attention Open the issue and send a correction
      - link "Review issue":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-20?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 7 Oct 2026, 7:28 pm IST
    - article:
      - link "Readiness 022 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-21?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…j2wf7-21 · Created by Readiness Admin Queued Next opportunity 8 Oct 2026, 4:28 pm IST
      - link "View status":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-21?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 7 Oct 2026, 6:28 pm IST
    - article:
      - link "Readiness 023 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-22?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…j2wf7-22 · Created by Readiness Admin Needs your reply
      - link "Reply":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-22?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 7 Oct 2026, 5:28 pm IST
    - article:
      - link "Readiness 024 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-23?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…j2wf7-23 · Created by Readiness Admin Needs attention Open the issue and send a correction
      - link "Review issue":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-23?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 7 Oct 2026, 4:28 pm IST
    - article:
      - link "Readiness 025 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-24?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…j2wf7-24 · Created by Readiness Admin Queued Next opportunity 8 Oct 2026, 4:28 pm IST
      - link "View status":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-24?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 7 Oct 2026, 3:28 pm IST
    - article:
      - link "Readiness 026 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-25?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…j2wf7-25 · Created by Readiness Admin Needs your reply
      - link "Reply":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-25?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 7 Oct 2026, 2:28 pm IST
    - article:
      - link "Readiness 027 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-26?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…j2wf7-26 · Created by Readiness Admin Needs attention Open the issue and send a correction
      - link "Review issue":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-26?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 7 Oct 2026, 1:28 pm IST
    - article:
      - link "Readiness 028 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-27?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…j2wf7-27 · Created by Readiness Admin Queued Next opportunity 8 Oct 2026, 4:28 pm IST
      - link "View status":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-27?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 7 Oct 2026, 12:28 pm IST
    - article:
      - link "Readiness 029 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-28?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…j2wf7-28 · Created by Readiness Admin Needs your reply
      - link "Reply":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-28?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 7 Oct 2026, 11:28 am IST
    - article:
      - link "Readiness 030 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-29?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…j2wf7-29 · Created by Readiness Admin Needs attention Open the issue and send a correction
      - link "Review issue":
        - /url: /admin/question-papers/chat/readiness-1791453505440-1ksm5mj2wf7-29?emulator=1&testEmail=readiness-1791453505440-1ksm5mj2wf7@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 7 Oct 2026, 10:28 am IST
  - text: 30 records shown
  - button "Continue search"
  - paragraph: Search uses whole words from titles, requirements, academic details and IDs. Use up to 8 words. All current admins can access these records.
- contentinfo:
  - paragraph:
    - text: © 2024 GTOP. Powered by
    - link "Growth Tutorials":
      - /url: https://growthtutorials.in/
  - paragraph:
    - text: All rights reserved.
    - link "Privacy Policy":
      - /url: "#"
    - text: "|"
    - link "Reload v1.2.21":
      - /url: "#"
```

# Test source

```ts
  1  | import {test,expect} from '@playwright/test';
  2  | import {execFile} from 'node:child_process';
  3  | import {promisify} from 'node:util';
  4  | import {initializeApp,deleteApp} from 'firebase/app';
  5  | import {getAuth,connectAuthEmulator,createUserWithEmailAndPassword} from 'firebase/auth';
  6  | import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
  7  | import {doc,setDoc,getDoc,Timestamp} from 'firebase/firestore';
  8  | test('readiness busy paper register has a bounded first page and older records',async({page},info)=>{
  9  |   test.setTimeout(180000);
  10 |   const tag='readiness-'+Date.now()+'-'+Math.random().toString(36).slice(2);
  11 |   const email=tag+'@gtop.test',password='IsolatedReadiness2026';
  12 |   const app=initializeApp({apiKey:'demo',projectId:'gtop-app'},tag);
  13 |   const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
  14 |   const uid=(await createUserWithEmailAndPassword(auth,email,password)).user.uid;
  15 |   const env=await initializeTestEnvironment({projectId:'gtop-app',firestore:{host:'127.0.0.1',port:8080}});
  16 |   try{
  17 |     await env.withSecurityRulesDisabled(async ctx=>{
  18 |       const db=ctx.firestore();
  19 |       await setDoc(doc(db,'users',uid),{uid,email,displayName:'Readiness Admin',role:'admin',board:'ICSE',standard:'9'});
  20 |       for(let i=0;i<90;i++){
  21 |         const id=tag+'-'+i,requestId=id+'-r1',when=Timestamp.fromMillis(Date.now()-i*3600000);
  22 |         const status=['queued','needs-info','error'][i%3];
  23 |         await setDoc(doc(db,'paperConversations',id),{title:'Readiness '+String(i+1).padStart(3,'0')+' · ICSE Class 9 Biology · Cells, tissues and plant reproduction',ownerUid:uid,status,revision:1,activeRequestId:requestId,createdAt:when,updatedAt:when});
  24 |         await setDoc(doc(db,'paperRequests',requestId),{source:'admin-paper-chat',conversationId:id,brief:'ICSE Class 9 Biology, 40 marks, 90 minutes. Include application and diagram questions.',requestedBy:uid,revision:1,status,createdAt:when,updatedAt:when,nextRunAtIso:new Date(Date.now()+3600000).toISOString(),progress:{step:'Waiting for scheduled opportunity',reused:0,generated:0},...(status==='needs-info'?{clarificationText:'Should plant reproduction include vegetative propagation?'}:{}),...(status==='error'?{error:'Synthetic readiness state: generation interrupted.'}:{})});
  25 |       }
  26 |       await expect.poll(async()=>!!(await getDoc(doc(db,'paperRegister',tag+'-89'))).exists(),{timeout:45000}).toBe(true);
  27 |     });
  28 |     await promisify(execFile)('node',['backfill-register.mjs','--until-ready','--restart'],{cwd:process.cwd()+'/functions',env:{...process.env,FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',GCLOUD_PROJECT:'gtop-app'},timeout:120000});
  29 |     await page.goto('/admin/question-papers?emulator=1&testEmail='+encodeURIComponent(email)+'&testPassword='+encodeURIComponent(password));
  30 |     await expect(page.getByRole('heading',{name:'Papers',exact:true})).toBeVisible({timeout:30000});
  31 |     await expect.poll(()=>page.locator('.pr-record').count(),{timeout:30000}).toBeGreaterThan(0);
  32 |     await page.getByLabel('Created by me').check();
  33 |     await expect.poll(()=>page.locator('.pr-record').count(),{timeout:30000}).toBe(30);
> 34 |     await expect(page.getByRole('button',{name:'Load older papers',exact:true})).toBeVisible();
     |                                                                                  ^ Error: expect(locator).toBeVisible() failed
  35 |     await page.evaluate(()=>document.fonts.ready);
  36 |     await page.screenshot({path:info.outputPath('busy-register-90-records.png'),fullPage:true,animations:'disabled'});
  37 |     await info.attach('fixture',{body:JSON.stringify({synthetic:true,sourceRecords:90,role:'admin',viewport:page.viewportSize(),sourceCommit:'00116b57042df34a49b99031dbea3c1bebe897a4'}),contentType:'application/json'});
  38 |     await page.getByRole('button',{name:'Load older papers',exact:true}).click();
  39 |     await expect.poll(()=>page.locator('.pr-record').count(),{timeout:30000}).toBeGreaterThan(30);
  40 |   }finally{await env.cleanup();await deleteApp(app);}
  41 | });
  42 | 
```