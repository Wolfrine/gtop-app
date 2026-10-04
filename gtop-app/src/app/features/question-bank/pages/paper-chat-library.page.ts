import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { PaperChatRepository } from '../core/paper-chat.repository';
import type { ChatSavedPaper } from '../core/paper-chat.models';
import { QuestionModuleHeaderComponent } from './question-module-header.component';

@Component({selector:'app-paper-chat-library-page',standalone:true,imports:[FormsModule,RouterLink,QuestionModuleHeaderComponent],templateUrl:'./paper-chat-library.page.html'})
export class PaperChatLibraryPage implements OnInit, OnDestroy {
  readonly papers = signal<ChatSavedPaper[]>([]);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly error = signal('');
  readonly cursor = signal<string | null>(null);
  readonly search = signal('');
  readonly filter = signal('all');
  readonly visible = computed(() => this.papers().filter(paper => {
    if (this.filter() === 'ready' && !this.ready(paper)) return false;
    if (this.filter() === 'draft' && paper.status !== 'draft') return false;
    const text = [paper.title,paper.board,paper.standard,...(paper.subjects ?? []),...(paper.chapters ?? [])].join(' ').toLocaleLowerCase();
    return !this.search().trim() || text.includes(this.search().trim().toLocaleLowerCase());
  }));
  private subscription?: Subscription;
  private loadedOlder = false;
  constructor(private readonly repository: PaperChatRepository) {}
  ngOnInit(): void { this.load(); }
  ngOnDestroy(): void { this.subscription?.unsubscribe(); }
  load(): void {
    this.subscription?.unsubscribe(); this.loadedOlder = false; this.loading.set(true); this.error.set('');
    this.subscription = this.repository.savedPapers$().subscribe({next: items => {
      if (this.loadedOlder) this.papers.update(existing => [...items,...existing.filter(paper => !items.some(item => item.id === paper.id))]);
      else {this.papers.set(items); this.cursor.set(items.length === 20 ? items.at(-1)!.id : null);}
      this.loading.set(false);
    },error: error => {this.loading.set(false); this.error.set(error instanceof Error ? error.message : 'Saved papers could not load. Reconnect and try again.');}});
  }
  async older(): Promise<void> {
    const cursor = this.cursor(); if (!cursor || this.loadingMore()) return;
    this.loadingMore.set(true); this.error.set('');
    try {
      const page = await this.repository.olderPapers(cursor);
      this.loadedOlder = true;
      this.papers.update(items => [...items,...page.filter(paper => !items.some(item => item.id === paper.id))]);
      this.cursor.set(page.length === 20 ? page.at(-1)!.id : null);
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Older papers could not load. Try again.'); }
    finally { this.loadingMore.set(false); }
  }
  ready(paper: ChatSavedPaper): boolean { return paper.status === 'ready' || paper.status === 'draft' && !!paper.sections?.length && paper.actualMarks === paper.marks && !paper.coverage?.gapCount; }
  openable(paper: ChatSavedPaper): boolean { return this.ready(paper) || paper.status === 'draft'; }
  status(paper: ChatSavedPaper): string {
    if (this.ready(paper)) return 'Ready to print';
    if (paper.status === 'draft') return 'Incomplete draft';
    return ({publishing:'Preparing paper',superseded:'Replaced by a newer request','publication-error':'Needs attention'} as Record<string,string>)[paper.status] ?? 'Unavailable';
  }
  unavailableReason(paper: ChatSavedPaper): string {
    if (paper.status === 'superseded') return 'A newer requirement replaced this paper.';
    if (paper.status === 'publication-error') return 'Open the conversation to check the request.';
    return 'The paper and answer key are still being prepared.';
  }
  chapters(paper: ChatSavedPaper): string { return (paper.chapters ?? []).join(', '); }
  date(value: unknown): string {
    const item = value as {toDate?: () => Date; seconds?: number; iso?: string} | undefined;
    const date = item?.toDate?.() ?? (item?.seconds ? new Date(item.seconds * 1000) : new Date(item?.iso ?? String(value ?? '')));
    return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-IN', {day:'numeric',month:'short',year:'numeric'}).format(date) : 'Saved paper';
  }
}
