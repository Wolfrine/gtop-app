import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BookOpen, FileText, CheckCircle, Clock } from 'lucide-react';

interface Chapter {
  id: string;
  name: string;
  questionsCount: number;
  completionPercentage: number;
  quizzesAttempted: number;
}

interface Subject {
  id: string;
  name: string;
  chapters: Chapter[];
}

const SyllabusPage = () => {
  const [selectedBoard, setSelectedBoard] = useState<string>('');
  const [selectedStandard, setSelectedStandard] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');

  // Mock data - in real app, this would come from API
  const boards = [
    { id: 'cbse', name: 'CBSE' },
    { id: 'icse', name: 'ICSE' },
    { id: 'state', name: 'State Board' }
  ];

  const standards = [
    { id: '5', name: 'Class 5' },
    { id: '6', name: 'Class 6' },
    { id: '7', name: 'Class 7' },
    { id: '8', name: 'Class 8' },
    { id: '9', name: 'Class 9' },
    { id: '10', name: 'Class 10' }
  ];

  const subjects: Subject[] = [
    {
      id: 'math',
      name: 'Mathematics',
      chapters: [
        { id: 'ch1', name: 'Number Systems', questionsCount: 45, completionPercentage: 85, quizzesAttempted: 12 },
        { id: 'ch2', name: 'Algebra', questionsCount: 38, completionPercentage: 60, quizzesAttempted: 8 },
        { id: 'ch3', name: 'Geometry', questionsCount: 52, completionPercentage: 40, quizzesAttempted: 5 },
        { id: 'ch4', name: 'Statistics', questionsCount: 28, completionPercentage: 95, quizzesAttempted: 15 }
      ]
    },
    {
      id: 'science',
      name: 'Science',
      chapters: [
        { id: 'ch1', name: 'Light and Reflection', questionsCount: 35, completionPercentage: 75, quizzesAttempted: 10 },
        { id: 'ch2', name: 'Acids and Bases', questionsCount: 42, completionPercentage: 90, quizzesAttempted: 14 },
        { id: 'ch3', name: 'Life Processes', questionsCount: 48, completionPercentage: 65, quizzesAttempted: 9 }
      ]
    },
    {
      id: 'english',
      name: 'English',
      chapters: [
        { id: 'ch1', name: 'Grammar Fundamentals', questionsCount: 55, completionPercentage: 80, quizzesAttempted: 11 },
        { id: 'ch2', name: 'Comprehension', questionsCount: 40, completionPercentage: 70, quizzesAttempted: 7 },
        { id: 'ch3', name: 'Literature', questionsCount: 32, completionPercentage: 55, quizzesAttempted: 6 }
      ]
    }
  ];

  const getCompletionColor = (percentage: number) => {
    if (percentage >= 80) return 'text-success';
    if (percentage >= 60) return 'text-warning';
    return 'text-destructive';
  };

  const getCompletionBadgeVariant = (percentage: number) => {
    if (percentage >= 80) return 'default';
    if (percentage >= 60) return 'secondary';
    return 'destructive';
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Syllabus Overview</h1>
          <p className="text-muted-foreground">Track your progress across subjects and chapters</p>
        </div>

        {/* Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Board</CardTitle>
              <CardDescription>Select your education board</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedBoard} onValueChange={setSelectedBoard}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose board" />
                </SelectTrigger>
                <SelectContent>
                  {boards.map((board) => (
                    <SelectItem key={board.id} value={board.id}>
                      {board.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Standard</CardTitle>
              <CardDescription>Select your class</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedStandard} onValueChange={setSelectedStandard}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose class" />
                </SelectTrigger>
                <SelectContent>
                  {standards.map((standard) => (
                    <SelectItem key={standard.id} value={standard.id}>
                      {standard.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        {/* Subjects Grid */}
        {selectedBoard && selectedStandard && (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Subjects</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {subjects.map((subject) => (
                <Card 
                  key={subject.id}
                  className={`cursor-pointer transition-all hover:shadow-elevation-2 ${
                    selectedSubject === subject.id ? 'ring-2 ring-primary shadow-elevation-2' : ''
                  }`}
                  onClick={() => setSelectedSubject(subject.id)}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-primary" />
                      {subject.name}
                    </CardTitle>
                    <CardDescription>
                      {subject.chapters.length} chapters available
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Questions</span>
                      <Badge variant="secondary">
                        {subject.chapters.reduce((acc, ch) => acc + ch.questionsCount, 0)}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Chapter Details */}
        {selectedSubject && (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">
              {subjects.find(s => s.id === selectedSubject)?.name} - Chapters
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {subjects
                .find(s => s.id === selectedSubject)
                ?.chapters.map((chapter) => (
                  <Card key={chapter.id} className="hover:shadow-elevation-1 transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg">{chapter.name}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant={getCompletionBadgeVariant(chapter.completionPercentage)}>
                          {chapter.completionPercentage}% Complete
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Progress Bar */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Chapter Progress</span>
                          <span className={getCompletionColor(chapter.completionPercentage)}>
                            {chapter.completionPercentage}%
                          </span>
                        </div>
                        <Progress 
                          value={chapter.completionPercentage} 
                          className="h-2"
                        />
                      </div>

                      {/* Chapter Stats */}
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="space-y-1">
                          <div className="flex items-center justify-center">
                            <FileText className="h-4 w-4 text-primary" />
                          </div>
                          <div className="text-sm font-medium">{chapter.questionsCount}</div>
                          <div className="text-xs text-muted-foreground">Questions</div>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center justify-center">
                            <CheckCircle className="h-4 w-4 text-success" />
                          </div>
                          <div className="text-sm font-medium">{chapter.quizzesAttempted}</div>
                          <div className="text-xs text-muted-foreground">Quizzes</div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-center">
                            <Clock className="h-4 w-4 text-warning" />
                          </div>
                          <div className="text-sm font-medium">
                            {Math.round((chapter.completionPercentage / 100) * chapter.questionsCount)}
                          </div>
                          <div className="text-xs text-muted-foreground">Solved</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!selectedBoard || !selectedStandard ? (
          <Card className="text-center py-12">
            <CardContent>
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                Select Board and Standard
              </h3>
              <p className="text-muted-foreground">
                Choose your education board and class to view available subjects and chapters
              </p>
            </CardContent>
          </Card>
        ) : !selectedSubject ? (
          <Card className="text-center py-12">
            <CardContent>
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                Select a Subject
              </h3>
              <p className="text-muted-foreground">
                Click on any subject above to view its chapters and your progress
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
};

export default SyllabusPage;