import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BookOpen, FileText, Plus, Minus, ArrowUpDown } from 'lucide-react';

interface Chapter {
  id: string;
  name: string;
  questionsCount: number;
  status: 'new' | 'existing' | 'removed' | 'modified';
  currentSystemQuestions?: number; // Questions in current system
}

interface Subject {
  id: string;
  name: string;
  chapters: Chapter[];
}

const SyllabusPreviewPage = () => {
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

  // Mock data showing differences between new syllabus and current system
  const subjects: Subject[] = [
    {
      id: 'math',
      name: 'Mathematics',
      chapters: [
        { id: 'ch1', name: 'Number Systems', questionsCount: 45, status: 'existing', currentSystemQuestions: 45 },
        { id: 'ch2', name: 'Algebra', questionsCount: 38, status: 'modified', currentSystemQuestions: 32 },
        { id: 'ch3', name: 'Geometry', questionsCount: 52, status: 'existing', currentSystemQuestions: 52 },
        { id: 'ch4', name: 'Statistics', questionsCount: 28, status: 'existing', currentSystemQuestions: 28 },
        { id: 'ch5', name: 'Coordinate Geometry', questionsCount: 35, status: 'new' },
        { id: 'ch6', name: 'Trigonometry Basics', questionsCount: 40, status: 'new' }
      ]
    },
    {
      id: 'science',
      name: 'Science',
      chapters: [
        { id: 'ch1', name: 'Light and Reflection', questionsCount: 35, status: 'existing', currentSystemQuestions: 35 },
        { id: 'ch2', name: 'Acids and Bases', questionsCount: 42, status: 'modified', currentSystemQuestions: 38 },
        { id: 'ch3', name: 'Life Processes', questionsCount: 48, status: 'existing', currentSystemQuestions: 48 },
        { id: 'ch4', name: 'Magnetic Effects of Current', questionsCount: 30, status: 'new' }
      ]
    },
    {
      id: 'english',
      name: 'English',
      chapters: [
        { id: 'ch1', name: 'Grammar Fundamentals', questionsCount: 55, status: 'existing', currentSystemQuestions: 55 },
        { id: 'ch2', name: 'Comprehension', questionsCount: 40, status: 'existing', currentSystemQuestions: 40 },
        { id: 'ch3', name: 'Literature', questionsCount: 32, status: 'modified', currentSystemQuestions: 28 },
        { id: 'ch4', name: 'Creative Writing', questionsCount: 25, status: 'new' }
      ]
    }
  ];

  // Summary of changes
  const getChangesSummary = () => {
    if (!selectedSubject) return null;
    
    const subject = subjects.find(s => s.id === selectedSubject);
    if (!subject) return null;

    const newChapters = subject.chapters.filter(ch => ch.status === 'new').length;
    const modifiedChapters = subject.chapters.filter(ch => ch.status === 'modified').length;
    const removedChapters = 0; // Would come from API comparing with current system
    
    return { newChapters, modifiedChapters, removedChapters };
  };

  const getStatusBadge = (status: Chapter['status']) => {
    switch (status) {
      case 'new':
        return <Badge className="bg-success/10 text-success border-success/20"><Plus className="h-3 w-3 mr-1" />New</Badge>;
      case 'modified':
        return <Badge className="bg-warning/10 text-warning border-warning/20"><ArrowUpDown className="h-3 w-3 mr-1" />Modified</Badge>;
      case 'removed':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20"><Minus className="h-3 w-3 mr-1" />Removed</Badge>;
      default:
        return <Badge variant="secondary">Existing</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Syllabus Preview</h1>
          <p className="text-muted-foreground">Compare new syllabus changes with current system</p>
          <div className="inline-flex items-center gap-2 mt-2">
            <Badge className="bg-success/10 text-success border-success/20"><Plus className="h-3 w-3 mr-1" />New</Badge>
            <Badge className="bg-warning/10 text-warning border-warning/20"><ArrowUpDown className="h-3 w-3 mr-1" />Modified</Badge>
            <Badge variant="secondary">Existing</Badge>
          </div>
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

        {/* Changes Summary */}
        {selectedSubject && getChangesSummary() && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ArrowUpDown className="h-5 w-5 text-primary" />
                Changes Summary
              </CardTitle>
              <CardDescription>
                Differences between new syllabus and current system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-success">{getChangesSummary()?.newChapters || 0}</div>
                  <div className="text-sm text-muted-foreground">New Chapters</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-warning">{getChangesSummary()?.modifiedChapters || 0}</div>
                  <div className="text-sm text-muted-foreground">Modified</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-muted-foreground">{getChangesSummary()?.removedChapters || 0}</div>
                  <div className="text-sm text-muted-foreground">Removed</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Chapter Details */}
        {selectedSubject && (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">
              {subjects.find(s => s.id === selectedSubject)?.name} - Chapters
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {subjects
                .find(s => s.id === selectedSubject)
                ?.chapters.map((chapter) => (
                  <Card key={chapter.id} className="hover:shadow-elevation-1 transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center justify-between">
                        <span>{chapter.name}</span>
                        {getStatusBadge(chapter.status)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Question Count */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-center p-4 bg-secondary/30 rounded-lg">
                          <div className="text-center">
                            <div className="flex items-center justify-center mb-2">
                              <FileText className="h-6 w-6 text-primary" />
                            </div>
                            <div className="text-2xl font-bold text-foreground">{chapter.questionsCount}</div>
                            <div className="text-sm text-muted-foreground">New Syllabus Questions</div>
                          </div>
                        </div>
                        
                        {/* Comparison for modified chapters */}
                        {chapter.status === 'modified' && chapter.currentSystemQuestions && (
                          <div className="flex items-center justify-between text-sm p-3 bg-warning/5 border border-warning/20 rounded-lg">
                            <span className="text-muted-foreground">Current System:</span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{chapter.currentSystemQuestions}</span>
                              <ArrowUpDown className="h-3 w-3 text-warning" />
                              <span className="font-medium text-warning">{chapter.questionsCount}</span>
                            </div>
                          </div>
                        )}
                        
                        {/* New chapter indicator */}
                        {chapter.status === 'new' && (
                          <div className="text-center p-2 bg-success/5 border border-success/20 rounded-lg">
                            <div className="text-sm text-success font-medium">
                              ✨ New chapter - needs mapping to current system
                            </div>
                          </div>
                        )}
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
                Click on any subject above to view its chapters and available questions
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
};

export default SyllabusPreviewPage;