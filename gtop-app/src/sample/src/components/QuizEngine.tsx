import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const QuizEngine = () => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(45);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);

  const quiz = {
    subject: "Mathematics",
    chapter: "Algebra",
    totalQuestions: 10,
    timePerQuestion: 45,
    questions: [
      {
        id: 1,
        question: "Solve for x: 2x + 5 = 13",
        options: ["x = 3", "x = 4", "x = 5", "x = 6"],
        correct: 1,
        explanation: "2x + 5 = 13\n2x = 13 - 5\n2x = 8\nx = 4"
      },
      {
        id: 2,
        question: "What is the value of 3² + 4²?",
        options: ["25", "24", "23", "26"],
        correct: 0,
        explanation: "3² = 9, 4² = 16\n9 + 16 = 25"
      }
    ]
  };

  const currentQ = quiz.questions[currentQuestion];
  const progress = ((currentQuestion + 1) / quiz.totalQuestions) * 100;

  const handleOptionSelect = (optionIndex: number) => {
    if (answered) return;
    setSelectedOption(optionIndex);
  };

  const handleSubmit = () => {
    if (selectedOption === null) return;
    
    setAnswered(true);
    if (selectedOption === currentQ.correct) {
      setScore(score + 1);
    }
    
    setTimeout(() => {
      if (currentQuestion < quiz.questions.length - 1) {
        setCurrentQuestion(currentQuestion + 1);
        setSelectedOption(null);
        setAnswered(false);
        setTimeLeft(45);
      }
    }, 2000);
  };

  const getOptionColor = (index: number) => {
    if (!answered) {
      return selectedOption === index ? "bg-primary text-primary-foreground" : "bg-surface hover:bg-accent";
    }
    
    if (index === currentQ.correct) {
      return "bg-success text-success-foreground";
    }
    
    if (selectedOption === index && index !== currentQ.correct) {
      return "bg-destructive text-destructive-foreground";
    }
    
    return "bg-surface opacity-60";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface border-b border-border px-4 py-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon">
              ←
            </Button>
            <div>
              <h1 className="font-semibold">{quiz.subject}</h1>
              <p className="text-sm text-muted-foreground">{quiz.chapter}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="px-3 py-1">
              {currentQuestion + 1}/{quiz.totalQuestions}
            </Badge>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-warning animate-pulse"></div>
              <span className="text-sm font-medium">{timeLeft}s</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-sm mb-2">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Question Card */}
        <Card className="p-8 border-0 shadow-elevation-3 mb-6">
          <div className="mb-6">
            <Badge className="mb-4">Question {currentQuestion + 1}</Badge>
            <h2 className="text-xl md:text-2xl font-semibold leading-relaxed">
              {currentQ.question}
            </h2>
          </div>

          {/* Options */}
          <div className="space-y-3 mb-8">
            {currentQ.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleOptionSelect(index)}
                disabled={answered}
                className={`w-full p-4 rounded-xl text-left border transition-all duration-200 hover:shadow-elevation-1 ${getOptionColor(index)}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center font-medium">
                    {String.fromCharCode(65 + index)}
                  </div>
                  <span className="font-medium">{option}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Explanation (shown after answering) */}
          {answered && (
            <div className="p-4 rounded-lg bg-accent/50 mb-6">
              <h4 className="font-medium mb-2">Explanation:</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {currentQ.explanation}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleSubmit}
              disabled={selectedOption === null || answered}
              className="flex-1"
              size="lg"
            >
              {answered ? "Moving to next..." : "Submit Answer"}
            </Button>
            
            <Button variant="outline" size="lg">
              🏷️ Bookmark
            </Button>
            
            <Button variant="outline" size="lg">
              🚩 Report
            </Button>
          </div>
        </Card>

        {/* Quiz Controls */}
        <div className="flex items-center justify-between bg-surface rounded-xl p-4 shadow-elevation-1">
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="text-muted-foreground">Score: </span>
              <span className="font-semibold text-success">{score}/{currentQuestion + (answered ? 1 : 0)}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Accuracy: </span>
              <span className="font-semibold">
                {currentQuestion > 0 || answered 
                  ? Math.round((score / (currentQuestion + (answered ? 1 : 0))) * 100) 
                  : 0}%
              </span>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button variant="ghost" size="sm">
              ⏸️ Pause
            </Button>
            <Button variant="destructive" size="sm">
              ❌ Exit Quiz
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default QuizEngine;