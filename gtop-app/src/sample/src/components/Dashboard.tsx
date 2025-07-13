import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const Dashboard = () => {
  const stats = {
    streak: 12,
    accuracy: 87,
    quizzesCompleted: 45,
    weeklyTarget: 7,
    weeklyCompleted: 5
  };

  const motivationalQuotes = [
    "Every expert was once a beginner. Keep practicing! 🌟",
    "Your consistency is building excellence! 💪",
    "Small progress each day leads to big results! 🚀"
  ];

  const recentQuizzes = [
    { subject: "Mathematics", chapter: "Algebra", score: 92, date: "Today" },
    { subject: "Science", chapter: "Physics", score: 78, date: "Yesterday" },
    { subject: "English", chapter: "Grammar", score: 95, date: "2 days ago" }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface border-b border-border px-4 py-4 md:px-6">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">GT</span>
            </div>
            <h1 className="text-xl font-bold text-gradient-primary">GTOP</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col text-right">
              <span className="text-sm font-medium">Alex Johnson</span>
              <span className="text-xs text-muted-foreground">Grade 8</span>
            </div>
            <Avatar className="h-10 w-10 border-2 border-primary/20">
              <div className="w-full h-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-semibold">
                AJ
              </div>
            </Avatar>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 md:px-6">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-2">
                Welcome back, Alex! 👋
              </h2>
              <p className="text-muted-foreground">
                {motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)]}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="quiz" size="lg">
                Quick Quiz
              </Button>
              <Button size="lg">
                Live Quiz
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4 text-center border-0 shadow-elevation-2 bg-success-container">
            <div className="text-2xl font-bold text-success mb-1">{stats.streak}</div>
            <div className="text-sm text-success/80">Day Streak 🔥</div>
          </Card>
          
          <Card className="p-4 text-center border-0 shadow-elevation-2 bg-primary-container">
            <div className="text-2xl font-bold text-primary mb-1">{stats.accuracy}%</div>
            <div className="text-sm text-primary/80">Accuracy</div>
          </Card>
          
          <Card className="p-4 text-center border-0 shadow-elevation-2 bg-secondary-container">
            <div className="text-2xl font-bold text-secondary mb-1">{stats.quizzesCompleted}</div>
            <div className="text-sm text-secondary/80">Quizzes Done</div>
          </Card>
          
          <Card className="p-4 text-center border-0 shadow-elevation-2 bg-warning-container">
            <div className="text-2xl font-bold text-warning mb-1">{stats.weeklyCompleted}/{stats.weeklyTarget}</div>
            <div className="text-sm text-warning/80">Weekly Goal</div>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <div className="lg:col-span-2">
            <Card className="p-6 border-0 shadow-elevation-2 mb-6">
              <h3 className="text-lg font-semibold mb-4">Quick Practice</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <span className="text-2xl">📚</span>
                  <span>Mathematics</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <span className="text-2xl">🔬</span>
                  <span>Science</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <span className="text-2xl">📖</span>
                  <span>English</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <span className="text-2xl">🌍</span>
                  <span>Social Studies</span>
                </Button>
              </div>
            </Card>

            {/* Recent Activity */}
            <Card className="p-6 border-0 shadow-elevation-2">
              <h3 className="text-lg font-semibold mb-4">Recent Quizzes</h3>
              <div className="space-y-4">
                {recentQuizzes.map((quiz, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-surface-variant">
                    <div className="flex-1">
                      <div className="font-medium">{quiz.subject}</div>
                      <div className="text-sm text-muted-foreground">{quiz.chapter}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge 
                        variant={quiz.score >= 90 ? "default" : quiz.score >= 70 ? "secondary" : "outline"}
                        className="px-2 py-1"
                      >
                        {quiz.score}%
                      </Badge>
                      <span className="text-xs text-muted-foreground">{quiz.date}</span>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="ghost" className="w-full mt-4">
                View All Results
              </Button>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Weekly Progress */}
            <Card className="p-6 border-0 shadow-elevation-2">
              <h3 className="text-lg font-semibold mb-4">Weekly Progress</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Quizzes</span>
                    <span>{stats.weeklyCompleted}/{stats.weeklyTarget}</span>
                  </div>
                  <Progress value={(stats.weeklyCompleted / stats.weeklyTarget) * 100} className="h-2" />
                </div>
                <Button variant="success" size="sm" className="w-full">
                  Keep Going! 💪
                </Button>
              </div>
            </Card>

            {/* Achievements */}
            <Card className="p-6 border-0 shadow-elevation-2">
              <h3 className="text-lg font-semibold mb-4">Recent Badges</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col items-center p-3 rounded-lg bg-success-container text-center">
                  <span className="text-2xl mb-1">🏆</span>
                  <span className="text-xs font-medium text-success">Math Master</span>
                </div>
                <div className="flex flex-col items-center p-3 rounded-lg bg-primary-container text-center">
                  <span className="text-2xl mb-1">⚡</span>
                  <span className="text-xs font-medium text-primary">Speed Demon</span>
                </div>
                <div className="flex flex-col items-center p-3 rounded-lg bg-secondary-container text-center">
                  <span className="text-2xl mb-1">📚</span>
                  <span className="text-xs font-medium text-secondary">Scholar</span>
                </div>
                <div className="flex flex-col items-center p-3 rounded-lg bg-warning-container text-center">
                  <span className="text-2xl mb-1">🔥</span>
                  <span className="text-xs font-medium text-warning">Streak King</span>
                </div>
              </div>
            </Card>

            {/* Quick Stats */}
            <Card className="p-6 border-0 shadow-elevation-2">
              <h3 className="text-lg font-semibold mb-4">This Month</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Questions</span>
                  <span className="font-medium">1,234</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Correct Answers</span>
                  <span className="font-medium text-success">1,074</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Study Time</span>
                  <span className="font-medium">24h 30m</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;