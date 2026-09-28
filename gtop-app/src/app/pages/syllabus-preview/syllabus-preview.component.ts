import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CurriculumService } from '../../services/curriculum.service';
import { applicableChapters, currentAcademicYear, curriculumDiff, curriculumValidation, emptyCurriculum,
  type CurriculumSubject, type CurriculumCoverageBoard, type LegacyChapter } from '../../services/curriculum.domain';
import { QuestionPaperRepository } from '../../features/question-bank/core/question-paper.repository';

@Component({ selector: 'app-syllabus-preview', standalone: true, imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './syllabus-preview.component.html' })
export class SyllabusPreviewComponent implements OnInit {
  year = currentAcademicYear();
  board = ''; standard = ''; search = ''; status = 'all';
  subjects: CurriculumSubject[] = [];
  published: CurriculumSubject[] = [];
  registry: CurriculumCoverageBoard[] = [];
  legacy: LegacyChapter[] = [];
  editor: CurriculumSubject | null = null;
  history: CurriculumSubject[] = [];
  viewedHistory: CurriculumSubject | null = null;
  selected = new Set<string>();
  checked = false; dirty = false; busy = false; error = ''; message = '';
  newBoard = ''; newStandard = ''; newSubject = '';
  imports: { id:string; board?:string; standard?:string; status?:string }[] = [];
  constructor(private readonly curriculum: CurriculumService, private readonly papers: QuestionPaperRepository, private readonly changeDetector: ChangeDetectorRef, private readonly zone: NgZone) {}
  async ngOnInit(): Promise<void> { await this.refresh(); }
  get boards(): string[] { return [...new Set([...this.registry.map(item => item.board), ...this.subjects.map(item => item.board)])].sort(); }
  get standards(): string[] { return [...new Set([...(this.registry.find(item => item.board === this.board)?.standards ?? []), ...this.subjects.filter(item => !this.board || item.board === this.board).map(item => item.standard)])].sort((a,b) => a.localeCompare(b, undefined, {numeric:true})); }
  get filtered(): CurriculumSubject[] { return this.subjects.filter(item => (!this.board || item.board === this.board) && (!this.standard || item.standard === this.standard) && (!this.search || `${item.subject} ${item.programme}`.toLowerCase().includes(this.search.toLowerCase())) && (this.status === 'all' || (this.status === 'approved' ? item.reviewStatus === 'approved' : item.reviewStatus !== 'approved'))); }
  get approvedCount(): number { return this.published.length; }
  get sourceNote(): CurriculumCoverageBoard | undefined { return this.registry.find(item => item.board === this.board); }
  get changes(): ReturnType<typeof curriculumDiff> { return this.editor ? curriculumDiff(this.published.find(item => item.id === this.editor!.id), this.editor) : {added:[],removed:[],changed:[]}; }
  get omittedBankChapters(): string[] {
    if (!this.editor) return [];
    const value = this.editor;
    return [...new Set(this.legacy.filter(item => item.board === value.board && String(item.standard) === value.standard && item.subject === value.subject)
      .filter(item => !value.chapters.some(chapter => chapter.title === item.chapter || chapter.bankAliases.some(alias => alias.subject === item.subject && alias.chapter === item.chapter))).map(item => item.chapter))];
  }
  errors(value: CurriculumSubject): string[] { return curriculumValidation(value); }
  label(value: CurriculumSubject): string { return value.reviewStatus === 'approved' ? 'Approved' : this.errors(value).length ? 'Needs verification' : 'Ready for review'; }
  async refresh(): Promise<void> {
    if (this.busy) return;
    if (!/^\d{4}-\d{2}$/.test(this.year)) { this.error = 'Enter an academic year such as 2026-27.'; return; }
    this.busy = true; this.error = ''; this.editor = null; this.selected.clear();
    try {
      this.legacy = await this.papers.syllabus();
      const result = await this.curriculum.catalogue(this.year, this.legacy);
      this.subjects = result.subjects; this.published = result.published; this.registry = result.seed.boards;
      this.imports = await this.curriculum.imports(this.year);
    } catch (error) { this.error = this.failure(error); }
    finally { this.busy = false; this.zone.run(() => this.changeDetector.markForCheck()); }
  }
  filterBoard(): void { this.standard = ''; }
  async requestImport(): Promise<void> {
    if (this.busy) return;
    this.busy = true; this.error = '';
    try {
      await this.curriculum.requestImport(this.year,this.board,this.standard);
      this.imports = await this.curriculum.imports(this.year);
      this.message = 'Source import requested. The creator will prepare drafts and report missing or inaccessible sources; admin approval is still required.';
    } catch(error) { this.error = this.failure(error); }
    finally { this.busy = false; this.zone.run(() => this.changeDetector.markForCheck()); }
  }
  preview(item: CurriculumSubject): void {
    this.editor = structuredClone(item); this.checked = false; this.dirty = false;
    this.history = []; this.viewedHistory = null; this.error = ''; this.message = '';
    requestAnimationFrame(() => document.getElementById('subject-preview')?.scrollIntoView({block:'start'}));
  }
  edit(): void { this.dirty = true; this.checked = false; if (this.editor) this.selected.delete(this.editor.id); }
  topics(index: number, value: string): void { if (this.editor) { this.editor.chapters[index].topics = value.split('\n').map(item => item.trim()).filter(Boolean); this.edit(); } }
  formativeTopics(index: number, value: string): void { if (this.editor) { this.editor.chapters[index].formativeTopics = value.split('\n').map(item => item.trim()).filter(Boolean); this.edit(); } }
  aliases(index: number, value: string): void {
    if (!this.editor) return;
    this.editor.chapters[index].bankAliases = value.split('\n').filter(item => item.trim()).map(item => {
      const split = item.indexOf(' | ');
      return split < 0 ? {subject:this.editor!.subject, chapter:item.trim()} : {subject:item.slice(0,split).trim(), chapter:item.slice(split+3).trim()};
    }); this.edit();
  }
  aliasText(index: number): string { return this.editor?.chapters[index].bankAliases.map(alias => `${alias.subject} | ${alias.chapter}`).join('\n') ?? ''; }
  addChapter(): void { this.editor?.chapters.push({title:'',topics:[],assessment:'both',bankAliases:[]}); this.edit(); }
  removeChapter(index: number): void { this.editor?.chapters.splice(index,1); this.edit(); }
  addSource(): void { this.editor?.sources.push({url:'',title:'',year:this.year,locator:''}); this.edit(); }
  newDraft(): void {
    if (!this.newBoard.trim() || !this.newStandard.trim() || !this.newSubject.trim()) { this.error = 'Enter a board, standard and subject.'; return; }
    const value = emptyCurriculum(this.newBoard,this.newStandard,this.newSubject,this.year);
    this.preview(this.subjects.find(item => item.id === value.id) ?? value);
    this.dirty = true;
  }
  async save(): Promise<void> {
    if (!this.editor || this.busy) return;
    this.busy = true; this.error = '';
    try {
      const saved = await this.curriculum.save(this.editor);
      this.subjects = [...this.subjects.filter(item => item.id !== saved.id), saved];
      this.editor = structuredClone(saved); this.dirty = false; this.checked = false;
      this.message = 'Draft saved. Review its sources and chapter list before approval.';
    } catch (error) { this.error = this.failure(error); }
    finally { this.busy = false; this.zone.run(() => this.changeDetector.markForCheck()); }
  }
  markReviewed(): void {
    if (!this.editor || !this.checked || this.dirty || !this.editor.revision || this.errors(this.editor).length || this.editor.reviewStatus === 'approved') return;
    this.selected.add(this.editor.id); this.message = `${this.editor.subject} added to the approval selection.`;
  }
  unselect(id: string): void { this.selected.delete(id); }
  async approve(): Promise<void> {
    if (this.busy || !this.selected.size) return;
    this.busy = true; this.error = ''; const successes: string[] = []; const failures: string[] = [];
    for (const id of [...this.selected]) {
      const value = this.subjects.find(item => item.id === id);
      if (!value) continue;
      try { await this.curriculum.approve(value); successes.push(value.subject); this.selected.delete(id); }
      catch (error) { failures.push(`${value.subject}: ${this.failure(error)}`); }
    }
    this.busy = false;
    await this.refresh();
    this.message = successes.length ? `Approved ${successes.length} subject${successes.length === 1 ? '' : 's'}. The new versions are now available for paper creation.` : '';
    this.error = failures.join(' '); this.zone.run(() => this.changeDetector.markForCheck());
  }
  async loadHistory(): Promise<void> {
    if (!this.editor || this.busy) return;
    this.busy = true;
    try { this.history = await this.curriculum.history(this.editor.id); }
    catch (error) { this.error = this.failure(error); }
    finally { this.busy = false; this.zone.run(() => this.changeDetector.markForCheck()); }
  }
  chapterCount(item: CurriculumSubject): number { return applicableChapters(item, 'summative').length; }
  private failure(error: unknown): string {
    if ((error as {code?:string})?.code === 'permission-denied') return 'The yearly syllabus service is not accessible. Check admin access and the deployed curriculum rules, then refresh. No approval was made.';
    return error instanceof Error ? error.message : 'Unable to update the syllabus. Please retry.';
  }
}
