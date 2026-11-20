import { ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, ViewChild, inject } from '@angular/core';
import { AssistantApi } from './api.service';

export interface StudentAccount {
  uid: string;
  displayName: string;
  board: string;
  standard: string;
  accountHint: string;
}

export async function getStudentAccount(api: AssistantApi, uid: string): Promise<StudentAccount> {
  const { student } = await api.request<{student: StudentAccount}>('/students/'+encodeURIComponent(uid));
  if (student?.uid !== uid) throw Error('The selected student account could not be verified.');
  return student;
}

@Component({
  selector: 'student-lookup',
  standalone: true,
  template: `
    @if (selected; as student) {
      <div class="selected">
        <div><strong>{{student.displayName}}</strong><small>{{context(student)}}</small></div>
        <button type="button" class="change" [disabled]="disabled" (click)="change()">Change student</button>
      </div>
    } @else {
      <label>Find a GTOP student
        <input #search type="search" autocomplete="off" placeholder="Start typing a student’s name" maxlength="80"
          [value]="query" [disabled]="disabled" (input)="update(search.value)">
      </label>
      @if (loading) { <p role="status">Searching students…</p> }
      @if (error) { <p role="alert">{{error}} <button class="change" type="button" [disabled]="disabled" (click)="nextCursor?more():update(query)">Try again</button></p> }
      @if (searched) {
        @if (!students.length && !nextCursor) {
          <p role="status">No matching students. If this is their first visit, ask the student to sign in to GTOP once, then search again.</p>
          <button type="button" class="change" [disabled]="disabled || loading" (click)="update(query)">Search again</button>
        }
        @if (students.length) {
          <div class="results" aria-label="Matching student accounts">
            @for (student of students; track student.uid) {
              <button class="result" type="button" [disabled]="disabled" (click)="pick(student)">
                <span><strong>{{student.displayName}}</strong><small>{{context(student)}}</small></span><span aria-hidden="true">→</span>
              </button>
            }
          </div>
        }
        @if (nextCursor && !error) { <button type="button" class="change" [disabled]="disabled || loading" (click)="more()">More matches</button> }
      }
      @if (!searched && !loading && !error) { <p class="hint">{{query.trim().length===1 ? 'Enter at least two characters.' : 'Students appear after their first GTOP sign-in.'}}</p> }
    }
  `,
  styles: [`
    :host{display:block;min-width:0;color:#284633;font:inherit}
    label{display:grid;gap:6px;font-size:14px;font-weight:650}
    input{box-sizing:border-box;width:100%;min-height:44px;padding:8px 12px;border:1px solid #aab8a3;border-radius:6px;background:#fffef9;color:#203629;font:inherit;font-weight:400;font-size:16px}
    button{font:inherit;cursor:pointer}button:disabled{cursor:default}
    button:focus-visible,input:focus-visible{outline:2px solid #365e41;outline-offset:2px}
    p,small{margin:6px 0;color:#53614f;font-size:13px;font-weight:400;line-height:1.45}small{display:block;margin:2px 0 0;overflow-wrap:anywhere}
    .results{margin-top:5px;border:1px solid #c9d2c1;border-radius:6px;overflow:auto;max-height:19rem}
    .result,.selected{display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px;padding:8px 12px;text-align:left;box-sizing:border-box;color:inherit}
    .result{border:0;min-height:46px;background:#fffef9}.result+.result{border-top:1px solid #dde2d6}.result:hover,.result:focus-visible{background:#eef3e6}.result:focus-visible{outline-offset:-2px}
    .selected{background:#eef3e7;border:1px solid #c4d0bb;border-radius:6px}.selected div,.result span{min-width:0}.selected strong,.result strong{overflow-wrap:anywhere}
    .change{padding:0 4px;min-height:44px;color:#31583c;border:0;background:transparent;font-size:13px;font-weight:650}.selected .change{flex:0 0 auto}
  `],
})
export class StudentLookupComponent implements OnChanges, OnDestroy {
  @Input() selected: StudentAccount | null = null;
  @Input() disabled = false;
  @Output() selectedChange = new EventEmitter<StudentAccount | null>();
  @ViewChild('search') private searchInput?: ElementRef<HTMLInputElement>;
  private api = inject(AssistantApi);
  private cd = inject(ChangeDetectorRef);
  private timer?: ReturnType<typeof setTimeout>;
  private revision = 0;
  query = '';
  loading = false;
  searched = false;
  error = '';
  students: StudentAccount[] = [];
  nextCursor: string | null = null;

  ngOnChanges() {
    if (this.selected) this.reset();
  }
  ngOnDestroy() { this.invalidate(); }

  context(student: StudentAccount) {
    return [student.standard ? 'Class '+student.standard : '', student.board, student.accountHint].filter(Boolean).join(' · ');
  }

  private invalidate() {
    clearTimeout(this.timer);
    return ++this.revision;
  }

  private reset() {
    this.invalidate();
    this.query = '';
    this.students = [];
    this.searched = false;
    this.loading = false;
    this.nextCursor = null;
    this.error = '';
  }

  change() {
    this.reset();
    this.selectedChange.emit(null);
    requestAnimationFrame(() => this.searchInput?.nativeElement.focus());
  }

  pick(student: StudentAccount) {
    this.reset();
    this.selectedChange.emit(student);
  }

  update(value: string) {
    if (this.disabled) return;
    if (this.selected) this.selectedChange.emit(null);
    this.reset();
    this.query = value;
    const query = value.trim();
    if (Array.from(query).length < 2) return;
    const revision = this.revision;
    this.loading = true;
    this.timer = setTimeout(() => void this.lookup(query, revision), 250);
  }

  more() {
    if (!this.nextCursor || this.loading) return;
    this.loading = true;
    this.error = '';
    void this.lookup(this.query.trim(), this.revision, this.nextCursor);
  }

  private async lookup(query: string, revision: number, cursor?: string) {
    try {
      const params = new URLSearchParams({q:query});
      if (cursor) params.set('cursor',cursor);
      const response = await this.api.request<{students: StudentAccount[]; nextCursor: string | null}>('/students/search?'+params.toString());
      if (revision !== this.revision) return;
      const seen = new Set(this.students.map(student => student.uid));
      this.students = [...this.students,...response.students.filter(student => !seen.has(student.uid))];
      this.nextCursor = response.nextCursor;
      this.searched = true;
    } catch (error) {
      if (revision === this.revision) this.error = error instanceof Error ? error.message : 'Student search could not be loaded.';
    } finally {
      if (revision === this.revision) { this.loading = false; this.cd.markForCheck(); }
    }
  }
}
