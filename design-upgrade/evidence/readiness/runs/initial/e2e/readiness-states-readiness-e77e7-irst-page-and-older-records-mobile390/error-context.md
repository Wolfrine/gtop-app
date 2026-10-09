# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: readiness-states.spec.ts >> readiness busy paper register has a bounded first page and older records
- Location: e2e/readiness-states.spec.ts:6:5

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
    - /url: /admin/question-papers?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
  - group: Updates
  - link "Bank tools":
    - /url: /admin/question-library?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
- main:
  - heading "Papers" [level=1]
  - paragraph: Requests and completed papers, together.
  - link "+ New paper":
    - /url: /admin/question-papers/new?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
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
  - status: The full register is being prepared. Existing papers remain available through their links and updates.
  - region "Paper register":
    - article:
      - link "Readiness 001 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-0?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…40ddiq-0 · Created by Readiness Admin Queued Next opportunity 8 Oct 2026, 4:16 pm IST
      - link "View status":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-0?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 8 Oct 2026, 3:16 pm IST
    - article:
      - link "Readiness 002 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-1?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…40ddiq-1 · Created by Readiness Admin Needs your reply
      - link "Reply":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-1?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 8 Oct 2026, 2:16 pm IST
    - article:
      - link "Readiness 003 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-2?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…40ddiq-2 · Created by Readiness Admin Needs attention Open the issue and send a correction
      - link "Review issue":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-2?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 8 Oct 2026, 1:16 pm IST
    - article:
      - link "Readiness 004 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-3?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…40ddiq-3 · Created by Readiness Admin Queued Next opportunity 8 Oct 2026, 4:16 pm IST
      - link "View status":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-3?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 8 Oct 2026, 12:16 pm IST
    - article:
      - link "Readiness 005 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-4?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…40ddiq-4 · Created by Readiness Admin Needs your reply
      - link "Reply":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-4?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 8 Oct 2026, 11:16 am IST
    - article:
      - link "Readiness 006 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-5?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…40ddiq-5 · Created by Readiness Admin Needs attention Open the issue and send a correction
      - link "Review issue":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-5?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 8 Oct 2026, 10:16 am IST
    - article:
      - link "Readiness 007 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-6?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…40ddiq-6 · Created by Readiness Admin Queued Next opportunity 8 Oct 2026, 4:16 pm IST
      - link "View status":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-6?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 8 Oct 2026, 9:16 am IST
    - article:
      - link "Readiness 008 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-7?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…40ddiq-7 · Created by Readiness Admin Needs your reply
      - link "Reply":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-7?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 8 Oct 2026, 8:16 am IST
    - article:
      - link "Readiness 009 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-8?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…40ddiq-8 · Created by Readiness Admin Needs attention Open the issue and send a correction
      - link "Review issue":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-8?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 8 Oct 2026, 7:16 am IST
    - article:
      - link "Readiness 010 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-9?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…40ddiq-9 · Created by Readiness Admin Queued Next opportunity 8 Oct 2026, 4:16 pm IST
      - link "View status":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-9?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 8 Oct 2026, 6:16 am IST
    - article:
      - link "Readiness 011 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-10?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…0ddiq-10 · Created by Readiness Admin Needs your reply
      - link "Reply":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-10?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 8 Oct 2026, 5:16 am IST
    - article:
      - link "Readiness 012 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-11?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…0ddiq-11 · Created by Readiness Admin Needs attention Open the issue and send a correction
      - link "Review issue":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-11?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 8 Oct 2026, 4:16 am IST
    - article:
      - link "Readiness 013 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-12?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…0ddiq-12 · Created by Readiness Admin Queued Next opportunity 8 Oct 2026, 4:16 pm IST
      - link "View status":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-12?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 8 Oct 2026, 3:16 am IST
    - article:
      - link "Readiness 014 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-13?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…0ddiq-13 · Created by Readiness Admin Needs your reply
      - link "Reply":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-13?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 8 Oct 2026, 2:16 am IST
    - article:
      - link "Readiness 015 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-14?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…0ddiq-14 · Created by Readiness Admin Needs attention Open the issue and send a correction
      - link "Review issue":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-14?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 8 Oct 2026, 1:16 am IST
    - article:
      - link "Readiness 016 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-15?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…0ddiq-15 · Created by Readiness Admin Queued Next opportunity 8 Oct 2026, 4:16 pm IST
      - link "View status":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-15?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 8 Oct 2026, 12:16 am IST
    - article:
      - link "Readiness 017 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-16?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…0ddiq-16 · Created by Readiness Admin Needs your reply
      - link "Reply":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-16?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 7 Oct 2026, 11:16 pm IST
    - article:
      - link "Readiness 018 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-17?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…0ddiq-17 · Created by Readiness Admin Needs attention Open the issue and send a correction
      - link "Review issue":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-17?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 7 Oct 2026, 10:16 pm IST
    - article:
      - link "Readiness 019 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-18?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…0ddiq-18 · Created by Readiness Admin Queued Next opportunity 8 Oct 2026, 4:16 pm IST
      - link "View status":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-18?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 7 Oct 2026, 9:16 pm IST
    - article:
      - link "Readiness 020 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-19?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…0ddiq-19 · Created by Readiness Admin Needs your reply
      - link "Reply":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-19?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 7 Oct 2026, 8:16 pm IST
    - article:
      - link "Readiness 021 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-20?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…0ddiq-20 · Created by Readiness Admin Needs attention Open the issue and send a correction
      - link "Review issue":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-20?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 7 Oct 2026, 7:16 pm IST
    - article:
      - link "Readiness 022 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-21?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…0ddiq-21 · Created by Readiness Admin Queued Next opportunity 8 Oct 2026, 4:16 pm IST
      - link "View status":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-21?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 7 Oct 2026, 6:16 pm IST
    - article:
      - link "Readiness 023 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-22?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…0ddiq-22 · Created by Readiness Admin Needs your reply
      - link "Reply":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-22?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 7 Oct 2026, 5:16 pm IST
    - article:
      - link "Readiness 024 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-23?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…0ddiq-23 · Created by Readiness Admin Needs attention Open the issue and send a correction
      - link "Review issue":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-23?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 7 Oct 2026, 4:16 pm IST
    - article:
      - link "Readiness 025 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-24?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…0ddiq-24 · Created by Readiness Admin Queued Next opportunity 8 Oct 2026, 4:16 pm IST
      - link "View status":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-24?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 7 Oct 2026, 3:16 pm IST
    - article:
      - link "Readiness 026 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-25?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…0ddiq-25 · Created by Readiness Admin Needs your reply
      - link "Reply":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-25?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 7 Oct 2026, 2:16 pm IST
    - article:
      - link "Readiness 027 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-26?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…0ddiq-26 · Created by Readiness Admin Needs attention Open the issue and send a correction
      - link "Review issue":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-26?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 7 Oct 2026, 1:16 pm IST
    - article:
      - link "Readiness 028 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-27?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…0ddiq-27 · Created by Readiness Admin Queued Next opportunity 8 Oct 2026, 4:16 pm IST
      - link "View status":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-27?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 7 Oct 2026, 12:16 pm IST
    - article:
      - link "Readiness 029 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-28?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…0ddiq-28 · Created by Readiness Admin Needs your reply
      - link "Reply":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-28?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 7 Oct 2026, 11:16 am IST
    - article:
      - link "Readiness 030 · ICSE Class 9 Biology · Cells, tissues and plant reproduction":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-29?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: read…0ddiq-29 · Created by Readiness Admin Needs attention Open the issue and send a correction
      - link "Review issue":
        - /url: /admin/question-papers/chat/readiness-1791452759993-pom240ddiq-29?emulator=1&testEmail=readiness-1791452759993-pom240ddiq@gtop.test&testPassword=IsolatedReadiness2026&paperMine=1
      - text: 7 Oct 2026, 10:16 am IST
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
  2  | import {initializeApp,deleteApp} from 'firebase/app';
  3  | import {getAuth,connectAuthEmulator,createUserWithEmailAndPassword} from 'firebase/auth';
  4  | import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
  5  | import {doc,setDoc,getDoc,Timestamp} from 'firebase/firestore';
  6  | test('readiness busy paper register has a bounded first page and older records',async({page},info)=>{
  7  |   test.setTimeout(90000);
  8  |   const tag='readiness-'+Date.now()+'-'+Math.random().toString(36).slice(2);
  9  |   const email=tag+'@gtop.test',password='IsolatedReadiness2026';
  10 |   const app=initializeApp({apiKey:'demo',projectId:'gtop-app'},tag);
  11 |   const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
  12 |   const uid=(await createUserWithEmailAndPassword(auth,email,password)).user.uid;
  13 |   const env=await initializeTestEnvironment({projectId:'gtop-app',firestore:{host:'127.0.0.1',port:8080}});
  14 |   try{
  15 |     await env.withSecurityRulesDisabled(async ctx=>{
  16 |       const db=ctx.firestore();
  17 |       await setDoc(doc(db,'users',uid),{uid,email,displayName:'Readiness Admin',role:'admin',board:'ICSE',standard:'9'});
  18 |       for(let i=0;i<90;i++){
  19 |         const id=tag+'-'+i,requestId=id+'-r1',when=Timestamp.fromMillis(Date.now()-i*3600000);
  20 |         const status=['queued','needs-info','error'][i%3];
  21 |         await setDoc(doc(db,'paperConversations',id),{title:'Readiness '+String(i+1).padStart(3,'0')+' · ICSE Class 9 Biology · Cells, tissues and plant reproduction',ownerUid:uid,status,revision:1,activeRequestId:requestId,createdAt:when,updatedAt:when});
  22 |         await setDoc(doc(db,'paperRequests',requestId),{source:'admin-paper-chat',conversationId:id,brief:'ICSE Class 9 Biology, 40 marks, 90 minutes. Include application and diagram questions.',requestedBy:uid,revision:1,status,createdAt:when,updatedAt:when,nextRunAtIso:new Date(Date.now()+3600000).toISOString(),progress:{step:'Waiting for scheduled opportunity',reused:0,generated:0},...(status==='needs-info'?{clarificationText:'Should plant reproduction include vegetative propagation?'}:{}),...(status==='error'?{error:'Synthetic readiness state: generation interrupted.'}:{})});
  23 |       }
  24 |       await expect.poll(async()=>!!(await getDoc(doc(db,'paperRegister',tag+'-89'))).exists(),{timeout:45000}).toBe(true);
  25 |     });
  26 |     await page.goto('/admin/question-papers?emulator=1&testEmail='+encodeURIComponent(email)+'&testPassword='+encodeURIComponent(password));
  27 |     await expect(page.getByRole('heading',{name:'Papers',exact:true})).toBeVisible({timeout:30000});
  28 |     await expect.poll(()=>page.locator('.pr-record').count(),{timeout:30000}).toBeGreaterThan(0);
  29 |     await page.getByLabel('Created by me').check();
  30 |     await expect.poll(()=>page.locator('.pr-record').count(),{timeout:30000}).toBe(30);
> 31 |     await expect(page.getByRole('button',{name:'Load older papers',exact:true})).toBeVisible();
     |                                                                                  ^ Error: expect(locator).toBeVisible() failed
  32 |     await page.evaluate(()=>document.fonts.ready);
  33 |     await page.screenshot({path:info.outputPath('busy-register-90-records.png'),fullPage:true,animations:'disabled'});
  34 |     await info.attach('fixture',{body:JSON.stringify({synthetic:true,sourceRecords:90,role:'admin',viewport:page.viewportSize(),sourceCommit:'00116b57042df34a49b99031dbea3c1bebe897a4'}),contentType:'application/json'});
  35 |     await page.getByRole('button',{name:'Load older papers',exact:true}).click();
  36 |     await expect.poll(()=>page.locator('.pr-record').count(),{timeout:30000}).toBeGreaterThan(30);
  37 |   }finally{await env.cleanup();await deleteApp(app);}
  38 | });
  39 | 
```