# GTOP User Manual — Teachers & Admins

## 1. What you can do
- Manage the MCQ bank: add, edit, delete, and filter questions.
- Maintain syllabus paths and MCQ counts.
- Host or join Live Quiz / Quiz Run sessions for groups.
- Build custom quizzes and review detailed reports for any user.

## 2. Sign in and access admin areas
1. Sign in with Google from the homepage.
2. Complete profile setup (Board and Standard). Admin role routes you to the admin dashboard.
3. Use the left navigation or toolbar shortcuts to open **MCQ Management**, **Add MCQ**, **Manage Syllabus**, **User List**, **Live**, **Quiz Run**, or **Reports**.

## 3. Adding MCQs in bulk
1. Go to **Add MCQ**.
2. Copy the provided JSON prompt, adjust board/standard/subject/chapter, and generate MCQs externally.
3. Paste the JSON array into the **Paste MCQs** box and click **Parse MCQs**.
4. Review the preview list (question, options, correct answer).
5. Click **Save MCQs** to store them in Firestore.
6. Use the back arrow to return to MCQ Management.

## 4. Managing existing MCQs
1. Open **MCQ Management**.
2. Use the filters (Board → Standard → Subject → Chapter) to narrow the list.
3. Expand a question to see its text, options, correct answer, and explanation.
4. Actions inside each row:
   - **Edit**: enter updated JSON, then **Save** to write back to Firestore.
   - **Delete**: remove the MCQ after confirming.
   - **Copy JSON**: grab the current question payload for editing elsewhere.
5. Use **Refresh Syllabus** if you need syllabus data rebuilt from the questions.
6. Use **Add** to open the Add MCQ screen; **Update MCQ count** lives under Manage Syllabus.

## 5. Managing syllabus entries
1. Go to **Manage Syllabus** to browse the hierarchy (Board → Standard → Subject → Chapter with MCQ counts).
2. Click the eye icon next to a chapter to jump to MCQ Management with filters applied.
3. Click **Edit Syllabus** to open the editable grid:
   - Filter by board/standard/subject to shrink the list.
   - Click the pencil, change board/standard/subject/chapter text, then click the check icon to save. Updates call the syllabus service with editor UID.
4. Click **Update MCQ count** on the main page to refresh stored counts from IndexedDB data.

## 6. Hosting or joining live practice
- **Quiz Run:** from the dashboard or routes under `/quiz-run`, create a lobby and share the code; participants join before you start. Use the quiz screen timer/auto-advance during play.
- **Live Quiz:** from `/live`, create a session with board/standard filters, question count, per-question timer, and a start time. Share the join code. Players join via the live join form; leaderboard and timers run per question.

## 7. Reviewing student performance
1. Open **User List** to see online/offline status and last seen times. Select a user and choose **View Reports** to open their reports page.
2. On **Reports**, you can also pass `?userId=<id>` in the URL to view any learner’s history.
3. Reports include summary cards, accuracy and quiz-type charts, and a session history list. Click a session to see the full quiz summary.
4. Use **Retry Incorrect** or **Retry Entire Quiz** inside a session to assign more practice.
5. **Exports:** There is no CSV/PDF export implemented. **TODO:** add export if needed.

## 8. Tags, difficulty levels, and syllabus units
- Questions include board, standard, subject, and chapter. There is no separate difficulty tag beyond the selected syllabus path. **TODO:** add explicit difficulty/tagging if required.
