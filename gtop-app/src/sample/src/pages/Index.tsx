import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: "🎯",
      title: "Smart Practice",
      description: "AI-powered questions that adapt to your learning pace",
      action: () => navigate("/dashboard")
    },
    {
      icon: "⚡",
      title: "Live Quizzes",
      description: "Compete with classmates in real-time quiz battles",
      action: () => navigate("/live-quiz")
    },
    {
      icon: "📊",
      title: "Progress Reports",
      description: "Track your improvement with detailed analytics",
      action: () => navigate("/reports")
    },
    {
      icon: "🏆",
      title: "Achievements",
      description: "Earn badges and maintain learning streaks",
      action: () => navigate("/dashboard")
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-primary text-primary-foreground">
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-24">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <span className="text-2xl font-bold">GT</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-bold">GTOP</h1>
            </div>
            
            <h2 className="text-2xl md:text-4xl font-semibold mb-4">
              Growth Tutorials Objective Practice
            </h2>
            
            <p className="text-lg md:text-xl opacity-90 mb-8 max-w-2xl mx-auto">
              The AI-powered MCQ learning platform that makes studying smart, engaging, and fun for students from Grade 5-10.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                variant="floating"
                className="bg-white text-primary hover:bg-white/90"
                onClick={() => navigate("/dashboard")}
              >
                🚀 Start Learning
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10"
                onClick={() => navigate("/live-quiz")}
              >
                ⚡ Join Live Quiz
              </Button>
            </div>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-10 left-10 w-20 h-20 rounded-full bg-white/10 blur-xl"></div>
        <div className="absolute bottom-10 right-10 w-32 h-32 rounded-full bg-white/10 blur-xl"></div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold mb-4">Why Students Love GTOP</h3>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Designed with students and parents in mind - clean, fast, and distraction-free learning experience.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card 
                key={index}
                className="p-6 border-0 shadow-elevation-2 hover:shadow-elevation-3 transition-all duration-200 cursor-pointer hover:scale-[1.02]"
                onClick={feature.action}
              >
                <div className="text-4xl mb-4 text-center">{feature.icon}</div>
                <h4 className="font-semibold mb-2 text-center">{feature.title}</h4>
                <p className="text-sm text-muted-foreground text-center">
                  {feature.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-surface">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-primary mb-2">10K+</div>
              <div className="text-sm text-muted-foreground">Active Students</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-success mb-2">95%</div>
              <div className="text-sm text-muted-foreground">Improvement Rate</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-secondary mb-2">500K+</div>
              <div className="text-sm text-muted-foreground">Questions Solved</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-warning mb-2">24/7</div>
              <div className="text-sm text-muted-foreground">Learning Support</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h3 className="text-3xl font-bold mb-4">Ready to Excel in Your Studies?</h3>
          <p className="text-lg text-muted-foreground mb-8">
            Join thousands of students who are already improving their grades with GTOP's smart learning system.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg"
              onClick={() => navigate("/dashboard")}
            >
              🎯 Start Your Journey
            </Button>
            <Button 
              variant="quiz" 
              size="lg"
              onClick={() => navigate("/quiz")}
            >
              🧠 Take a Quick Quiz
            </Button>
          </div>
          
          <div className="flex flex-wrap justify-center gap-2 mt-8">
            <Badge variant="outline" className="px-3 py-1">Grade 5-10</Badge>
            <Badge variant="outline" className="px-3 py-1">All Subjects</Badge>
            <Badge variant="outline" className="px-3 py-1">AI-Powered</Badge>
            <Badge variant="outline" className="px-3 py-1">Mobile Friendly</Badge>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground text-background py-8">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">GT</span>
            </div>
            <span className="text-xl font-bold">GTOP</span>
          </div>
          <p className="text-sm opacity-80">
            Making learning accessible, engaging, and effective for every student.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
