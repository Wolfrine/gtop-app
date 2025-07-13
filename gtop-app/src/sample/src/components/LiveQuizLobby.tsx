import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";

const LiveQuizLobby = () => {
  const [role, setRole] = useState<'participant' | 'viewer' | null>(null);
  const [countdown, setCountdown] = useState(45);

  const quizInfo = {
    title: "Mathematics Challenge",
    subject: "Algebra & Geometry",
    difficulty: "Medium",
    questions: 15,
    duration: "20 minutes",
    host: "Ms. Sarah Johnson",
    code: "MATH2024"
  };

  const participants = [
    { id: 1, name: "Alex Chen", status: "ready", avatar: "AC", score: 0 },
    { id: 2, name: "Emma Davis", status: "ready", avatar: "ED", score: 0 },
    { id: 3, name: "Raj Patel", status: "waiting", avatar: "RP", score: 0 },
    { id: 4, name: "Sofia Lopez", status: "ready", avatar: "SL", score: 0 },
    { id: 5, name: "Marcus Kim", status: "waiting", avatar: "MK", score: 0 },
    { id: 6, name: "Zara Ahmed", status: "ready", avatar: "ZA", score: 0 }
  ];

  const viewers = [
    { id: 1, name: "Parent - Alex's Mom", avatar: "AM" },
    { id: 2, name: "Teacher - Mr. Williams", avatar: "MW" },
    { id: 3, name: "Parent - Emma's Dad", avatar: "ED" }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'bg-success text-success-foreground';
      case 'waiting': return 'bg-warning text-warning-foreground';
      default: return 'bg-muted text-muted-foreground';
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
              <h1 className="font-semibold">Live Quiz Lobby</h1>
              <p className="text-sm text-muted-foreground">Join or watch the quiz</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge className="px-3 py-1 text-lg font-mono">
              {quizInfo.code}
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Quiz Info Banner */}
        <Card className="p-6 border-0 shadow-elevation-2 mb-6 bg-gradient-primary text-primary-foreground">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold mb-2">{quizInfo.title}</h2>
              <div className="flex flex-wrap gap-4 text-sm opacity-90">
                <span>📚 {quizInfo.subject}</span>
                <span>📊 {quizInfo.difficulty}</span>
                <span>❓ {quizInfo.questions} Questions</span>
                <span>⏱️ {quizInfo.duration}</span>
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">{countdown}</div>
              <div className="text-sm opacity-90">Seconds to start</div>
            </div>
          </div>
        </Card>

        {/* Role Selection (if not selected) */}
        {!role && (
          <Card className="p-8 border-0 shadow-elevation-2 mb-6 text-center">
            <h3 className="text-xl font-semibold mb-4">How would you like to join?</h3>
            <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">
              <button
                onClick={() => setRole('participant')}
                className="p-6 rounded-xl border-2 border-primary/20 bg-primary-container hover:bg-primary hover:text-primary-foreground transition-all duration-200 hover:shadow-elevation-2"
              >
                <div className="text-4xl mb-3">🎯</div>
                <h4 className="font-semibold mb-2">Join as Participant</h4>
                <p className="text-sm opacity-80">Compete and answer questions</p>
              </button>
              
              <button
                onClick={() => setRole('viewer')}
                className="p-6 rounded-xl border-2 border-secondary/20 bg-secondary-container hover:bg-secondary hover:text-secondary-foreground transition-all duration-200 hover:shadow-elevation-2"
              >
                <div className="text-4xl mb-3">👀</div>
                <h4 className="font-semibold mb-2">Join as Viewer</h4>
                <p className="text-sm opacity-80">Watch and cheer others</p>
              </button>
            </div>
          </Card>
        )}

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Participants List */}
          <div className="lg:col-span-2">
            <Card className="p-6 border-0 shadow-elevation-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  Participants ({participants.length})
                </h3>
                <Badge variant="outline" className="px-3 py-1">
                  {participants.filter(p => p.status === 'ready').length} Ready
                </Badge>
              </div>
              
              <div className="grid sm:grid-cols-2 gap-3">
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-surface-variant hover:bg-accent transition-colors"
                  >
                    <Avatar className="h-10 w-10">
                      <div className="w-full h-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
                        {participant.avatar}
                      </div>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-medium">{participant.name}</div>
                      <Badge 
                        className={`text-xs ${getStatusColor(participant.status)}`}
                        variant="secondary"
                      >
                        {participant.status}
                      </Badge>
                    </div>
                    {role === 'participant' && participant.name === 'Alex Chen' && (
                      <Badge className="text-xs bg-accent text-accent-foreground">
                        You
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
              
              {role === 'participant' && (
                <div className="mt-6 pt-4 border-t border-border">
                  <div className="flex gap-3">
                    <Button className="flex-1" size="lg">
                      ✅ I'm Ready!
                    </Button>
                    <Button variant="outline" size="lg">
                      ⚙️ Settings
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quiz Host */}
            <Card className="p-6 border-0 shadow-elevation-2">
              <h3 className="text-lg font-semibold mb-4">Quiz Host</h3>
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <div className="w-full h-full bg-gradient-secondary flex items-center justify-center text-secondary-foreground font-semibold">
                    SJ
                  </div>
                </Avatar>
                <div>
                  <div className="font-medium">{quizInfo.host}</div>
                  <div className="text-sm text-muted-foreground">Teacher</div>
                </div>
              </div>
            </Card>

            {/* Viewers */}
            <Card className="p-6 border-0 shadow-elevation-2">
              <h3 className="text-lg font-semibold mb-4">
                Viewers ({viewers.length})
              </h3>
              <div className="space-y-3">
                {viewers.map((viewer) => (
                  <div
                    key={viewer.id}
                    className="flex items-center gap-3 p-2 rounded-lg"
                  >
                    <Avatar className="h-8 w-8">
                      <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground font-medium text-xs">
                        {viewer.avatar}
                      </div>
                    </Avatar>
                    <div className="text-sm">{viewer.name}</div>
                  </div>
                ))}
              </div>
              
              {role === 'viewer' && (
                <div className="mt-4 pt-4 border-t border-border">
                  <Button variant="secondary" size="sm" className="w-full">
                    👁️ Viewing Mode Active
                  </Button>
                </div>
              )}
            </Card>

            {/* Quick Stats */}
            <Card className="p-6 border-0 shadow-elevation-2">
              <h3 className="text-lg font-semibold mb-4">Quiz Details</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Difficulty</span>
                  <Badge variant="outline">{quizInfo.difficulty}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Questions</span>
                  <span className="font-medium">{quizInfo.questions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-medium">{quizInfo.duration}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Join Code</span>
                  <span className="font-mono font-medium">{quizInfo.code}</span>
                </div>
              </div>
            </Card>

            {/* Leave Button */}
            <Button variant="destructive" className="w-full">
              Leave Lobby
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LiveQuizLobby;