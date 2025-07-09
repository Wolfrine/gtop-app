import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';

interface Subject {
  name: string;
  chapters: string[];
}

interface SyllabusFile {
  subjects: Subject[];
}

@Component({
  selector: 'app-syllabus-preview',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    FormsModule,
    MatToolbarModule,
    MatFormFieldModule,
    MatSelectModule,
    MatCardModule,
    MatListModule,
    MatButtonModule
  ],
  templateUrl: './syllabus-preview.component.html',
  styleUrls: ['./syllabus-preview.component.scss']
})
export class SyllabusPreviewComponent implements OnInit {
  boardList: string[] = [];
  standardList: string[] = [];

  selectedBoard: string | null = null;
  selectedStandard: string | null = null;

  subjects: Subject[] = [];
  chapters: string[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadIndex();
  }

  private loadIndex() {
    this.http.get<string[]>('assets/syllabus/index.json').subscribe(files => {
      const pairs = files.map(f => {
        const [board, rest] = f.split('-');
        const standard = rest.replace(/\.json$/i, '');
        return { board: board.toUpperCase(), standard, file: f };
      });
      this.boardList = [...new Set(pairs.map(p => p.board))];
      // Optionally build standardList depending on selected board
      this.updateStandardList(pairs);
    });
  }

  onBoardChange(board: string) {
    this.selectedBoard = board;
    this.selectedStandard = null;
    this.subjects = [];
    this.chapters = [];
    this.loadIndex(); // reload to update standard list
  }

  private updateStandardList(pairs: { board: string; standard: string; file: string }[]) {
    if (this.selectedBoard) {
      this.standardList = pairs.filter(p => p.board === this.selectedBoard).map(p => p.standard);
    } else {
      this.standardList = [];
    }
  }

  onStandardChange(standard: string) {
    this.selectedStandard = standard;
    this.subjects = [];
    this.chapters = [];
    if (this.selectedBoard && this.selectedStandard) {
      const file = `${this.selectedBoard.toLowerCase()}-${this.selectedStandard}.json`;
      this.http.get<SyllabusFile>(`assets/syllabus/${file}`).subscribe(data => {
        this.subjects = data.subjects;
      });
    }
  }

  onSubjectSelect(subject: Subject) {
    this.chapters = subject.chapters;
  }
}
