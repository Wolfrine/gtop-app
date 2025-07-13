import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const ReportsPage = () => {
  const overallStats = {
    totalQuizzes: 45,
    averageScore: 87,
    bestStreak: 12,
    studyTime: "24h 30m"
  };

  const subjectPerformance = [
    { subject: "Mathematics", correct: 85, wrong: 15, accuracy: 85, trend: "up" },
    { subject: "Science", correct: 78, wrong: 22, accuracy: 78, trend: "up" },
    { subject: "English", correct: 92, wrong: 8, accuracy: 92, trend: "stable" },
    { subject: "Social Studies", correct: 71, wrong: 29, accuracy: 71, trend: "down" }
  ];

  const weeklyProgress = [
    { week: "Week 1", score: 75 },
    { week: "Week 2", score: 82 },
    { week: "Week 3", score: 78 },
    { week: "Week 4", score: 87 }
  ];

  const chapterAnalysis = {
    strongest: [
      { chapter: "Grammar", subject: "English", accuracy: 95 },
      { chapter: "Basic Algebra", subject: "Mathematics", accuracy: 92 },
      { chapter: "Plant Biology", subject: "Science", accuracy: 89 }
    ],
    needsWork: [
      { chapter: "Geometry", subject: "Mathematics", accuracy: 64 },
      { chapter: "Physics", subject: "Science", accuracy: 68 },
      { chapter: "World History", subject: "Social Studies", accuracy: 71 }
    ]
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <span className="text-success">📈</span>;
      case 'down': return <span className="text-destructive">📉</span>;
      default: return <span className="text-muted-foreground">➡️</span>;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return 'text-success';
      case 'down': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface border-b border-border px-4 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon">
              ←
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Performance Reports</h1>
              <p className="text-sm text-muted-foreground">Track your learning progress</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              📊 Export PDF
            </Button>
            <Button variant="outline" size="sm">
              📅 Date Range
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Overall Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4 text-center border-0 shadow-elevation-2 bg-primary-container">
            <div className="text-2xl font-bold text-primary mb-1">{overallStats.totalQuizzes}</div>
            <div className="text-sm text-primary/80">Total Quizzes</div>
          </Card>
          
          <Card className="p-4 text-center border-0 shadow-elevation-2 bg-success-container">
            <div className="text-2xl font-bold text-success mb-1">{overallStats.averageScore}%</div>
            <div className="text-sm text-success/80">Average Score</div>
          </Card>
          
          <Card className="p-4 text-center border-0 shadow-elevation-2 bg-warning-container">
            <div className="text-2xl font-bold text-warning mb-1">{overallStats.bestStreak}</div>
            <div className="text-sm text-warning/80">Best Streak</div>
          </Card>
          
          <Card className="p-4 text-center border-0 shadow-elevation-2 bg-secondary-container">
            <div className="text-2xl font-bold text-secondary mb-1">{overallStats.studyTime}</div>
            <div className="text-sm text-secondary/80">Study Time</div>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Subject Performance */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6 border-0 shadow-elevation-2">
              <h3 className="text-lg font-semibold mb-6">Subject Performance</h3>
              <div className="space-y-4">
                {subjectPerformance.map((subject, index) => (
                  <div key={index} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{subject.subject}</span>
                        {getTrendIcon(subject.trend)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={subject.accuracy >= 85 ? "default" : subject.accuracy >= 70 ? "secondary" : "outline"}
                          className="px-2 py-1"
                        >
                          {subject.accuracy}%
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Correct:</span>
                        <span className="font-medium text-success">{subject.correct}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Wrong:</span>
                        <span className="font-medium text-destructive">{subject.wrong}%</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <div className="flex-1 bg-success-container rounded-full h-2" 
                           style={{width: `${subject.correct}%`}}></div>
                      <div className="flex-1 bg-destructive-container rounded-full h-2"
                           style={{width: `${subject.wrong}%`}}></div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Weekly Progress Chart */}
            <Card className="p-6 border-0 shadow-elevation-2">
              <h3 className="text-lg font-semibold mb-6">Weekly Progress</h3>
              <div className="space-y-4">
                {weeklyProgress.map((week, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className="w-20 text-sm text-muted-foreground">
                      {week.week}
                    </div>
                    <div className="flex-1">
                      <Progress value={week.score} className="h-3" />
                    </div>
                    <div className="w-12 text-sm font-medium text-right">
                      {week.score}%
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 p-4 bg-success-container rounded-lg">
                <div className="flex items-center gap-2 text-success">
                  <span className="text-lg">📈</span>
                  <span className="font-medium">Great improvement!</span>
                </div>
                <p className="text-sm text-success/80 mt-1">
                  Your average has increased by 12% over the last month.
                </p>
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Strongest Chapters */}
            <Card className="p-6 border-0 shadow-elevation-2">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="text-xl">🏆</span>
                Strongest Chapters
              </h3>
              <div className="space-y-3">
                {chapterAnalysis.strongest.map((chapter, index) => (
                  <div key={index} className="p-3 rounded-lg bg-success-container">
                    <div className="font-medium text-success mb-1">{chapter.chapter}</div>
                    <div className="flex justify-between text-sm">
                      <span className="text-success/80">{chapter.subject}</span>
                      <span className="font-medium text-success">{chapter.accuracy}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Needs Improvement */}
            <Card className="p-6 border-0 shadow-elevation-2">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="text-xl">🎯</span>
                Needs Work
              </h3>
              <div className="space-y-3">
                {chapterAnalysis.needsWork.map((chapter, index) => (
                  <div key={index} className="p-3 rounded-lg bg-warning-container">
                    <div className="font-medium text-warning mb-1">{chapter.chapter}</div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-warning/80">{chapter.subject}</span>
                      <span className="font-medium text-warning">{chapter.accuracy}%</span>
                    </div>
                    <Button variant="outline" size="sm" className="w-full text-xs">
                      Practice More
                    </Button>
                  </div>
                ))}
              </div>
            </Card>

            {/* Quick Actions */}
            <Card className="p-6 border-0 shadow-elevation-2">
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Button variant="quiz" className="w-full justify-start" size="sm">
                  📚 Practice Weak Areas
                </Button>
                <Button variant="outline" className="w-full justify-start" size="sm">
                  🎯 Set New Goals
                </Button>
                <Button variant="outline" className="w-full justify-start" size="sm">
                  📊 Detailed Analytics
                </Button>
                <Button variant="outline" className="w-full justify-start" size="sm">
                  📤 Share Progress
                </Button>
              </div>
            </Card>

            {/* Achievement Summary */}
            <Card className="p-6 border-0 shadow-elevation-2">
              <h3 className="text-lg font-semibold mb-4">This Month</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">🏅 Badges Earned</span>
                  <span className="font-medium">4</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">⚡ Best Daily Score</span>
                  <span className="font-medium">95%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">🔥 Longest Streak</span>
                  <span className="font-medium">12 days</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">📈 Improvement</span>
                  <span className="font-medium text-success">+12%</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ReportsPage;