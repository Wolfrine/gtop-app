export const adminGroups = [
    { key: 'content', title: 'Content', icon: 'menu_book', summary: 'Questions, syllabus and review', label: 'Question bank tools', tools: [
        { title: 'Question bank', route: '/admin/question-library', detail: 'Browse the question library' },
        { title: 'MCQ management', route: '/admin/mcq-management', detail: 'Search, edit and organise MCQs' },
        { title: 'Review new questions', route: '/admin/question-review', detail: 'Open the question review queue' },
        { title: 'Add MCQs', route: '/admin/add-mcq', detail: 'Create practice questions' },
        { title: 'Question requests', route: '/admin/question-bank', detail: 'Review coverage and priorities' },
        { title: 'Manage syllabus', route: '/admin/manage-syllabus', detail: 'Maintain subjects and chapters' },
        { title: 'Syllabus review', route: '/syllabus-preview', detail: 'Inspect the published view' },
        { title: 'Paper chat', route: '/admin/question-papers', detail: 'Open earlier conversations and saved papers' },
        { title: 'Paper generator', route: '/admin/question-paper-generator', detail: 'Open the existing paper builder' },
    ] },
    { key: 'students', title: 'Students', icon: 'groups', summary: 'Accounts, access and activity', label: 'Student tools', tools: [
        { title: 'User management', route: '/admin/user-list', detail: 'Find accounts, manage roles and open learner reports' },
    ] },
    { key: 'insights', title: 'Insights', icon: 'insights', summary: 'Progress and lab results', label: 'Reporting tools', tools: [
        { title: 'Progress', route: '/reports', detail: 'Review your quiz attempts' },
        { title: 'Learning Lab results', route: '/learning-lab/results', detail: 'Review learner experiment feedback' },
        { title: 'Plant Lab results', route: '/learning-lab/plants/results', detail: 'Review plant reproduction feedback' },
    ] },
    { key: 'operations', title: 'Operations', icon: 'tune', summary: 'Action plan and system tools', label: 'Operations tools', tools: [
        { title: 'Action Plan', route: '/admin/action-plan', detail: 'Review priorities and ownership' },
        { title: 'Activity logs', route: '/logs', detail: 'Inspect application activity' },
        { title: 'UI preview', route: '/dev/ui', detail: 'Review interface components' },
    ] },
] as const;
