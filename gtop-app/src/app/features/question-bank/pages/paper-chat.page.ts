import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { QuestionModuleHeaderComponent } from './question-module-header.component';
import { PaperChatRepository } from '../core/paper-chat.repository';
import { nextPaperRun, paperStatusLabels, type ChatSavedPaper, type PaperChatMessage, type PaperChatRequest, type PaperConversation, type PaperNotification } from '../core/paper-chat.models';

// Keep unsent drafts when an admin moves between conversations during this visit.
const composerDrafts = new Map<string,string>();

@Component({
  selector: 'app-paper-chat-page', standalone: true,
  imports: [FormsModule, RouterLink, QuestionModuleHeaderComponent],
  templateUrl: './paper-chat.page.html',
})
export class PaperChatPage implements OnInit, OnDestroy {
  @ViewChild('thread') private thread?: ElementRef<HTMLElement>;
  @ViewChild('composer') private composer?: ElementRef<HTMLTextAreaElement>;
  readonly conversations = signal<PaperConversation[]>([]);
  readonly messages = signal<PaperChatMessage[]>([]);
  readonly requests = signal<PaperChatRequest[]>([]);
  readonly papers = signal<ChatSavedPaper[]>([]);
  readonly notifications = signal<PaperNotification[]>([]);
  readonly conversationId = signal('');
  private readonly clock = signal(Date.now());
  private readonly clockTimer = setInterval(() => this.clock.set(Date.now()),30_000);
  readonly loading = signal(false);
  readonly loadingHistory = signal(true);
  readonly error = signal('');
  readonly sending = signal(false);
  readonly sendError = signal('');
  readonly actionBusy = signal('');
  readonly sent = signal('');
  readonly pushMessage = signal('');
  readonly notificationError = signal('');
  readonly unread = computed(() => this.notifications().filter(item => !item.read).length);
  readonly conversation = computed(() => this.conversations().find(item => item.id === this.conversationId()));
  readonly pending = computed(() => this.requests().find(item => ['queued','generating','publishing','needs-info'].includes(item.status)));
  readonly unlinkedRequests = computed(() => this.requests().filter(item => item.status !== 'completed' && !this.messages().some(message => message.requestId === item.id && message.role !== 'admin')));
  readonly unlinkedPapers = computed(() => this.papers().filter(item => item.conversationId === this.conversationId() && this.isReadyPaper(item) && !this.messages().some(message => message.paperId === item.id)));
  requirement = '';
  private readonly subscriptions = new Subscription();
  private threadSubscriptions = new Subscription();
  private historySubscriptions = new Subscription();
  private scrollTimer?: ReturnType<typeof setTimeout>;
  private opened = false;

  constructor(private readonly repository: PaperChatRepository, private readonly route: ActivatedRoute, private readonly router: Router) {}
  ngOnInit(): void {
    this.loadHistory();
    this.subscriptions.add(this.route.paramMap.subscribe(params => this.open(params.get('conversationId') ?? '')));
  }
  ngOnDestroy(): void {
    this.rememberDraft(); clearInterval(this.clockTimer);
    this.subscriptions.unsubscribe(); this.threadSubscriptions.unsubscribe(); this.historySubscriptions.unsubscribe();
    if (this.scrollTimer) clearTimeout(this.scrollTimer);
  }
  loadHistory(): void {
    this.historySubscriptions.unsubscribe(); this.historySubscriptions = new Subscription(); this.loadingHistory.set(true);
    this.historySubscriptions.add(this.repository.conversations$().subscribe({next: items => {this.conversations.set(items); this.loadingHistory.set(false);},error: () => {this.loadingHistory.set(false); this.error.set('Recent chats could not load. Reconnect and try again.');}}));
    this.historySubscriptions.add(this.repository.savedPapers$().subscribe({next: items => this.papers.set(items),error: () => this.error.set('Saved paper details could not load. You can still open a paper from its conversation.')}));
    this.historySubscriptions.add(this.repository.notifications$().subscribe({next: items => this.notifications.set(items),error: () => this.notificationError.set('Updates could not load. Reconnect to see the latest notifications.')}));
  }
  open(id: string): void {
    if (this.opened) this.rememberDraft();
    this.opened = true; this.requirement = composerDrafts.get(id) ?? '';
    this.threadSubscriptions.unsubscribe(); this.threadSubscriptions = new Subscription();
    this.conversationId.set(id); this.messages.set([]); this.requests.set([]); this.error.set(''); this.sent.set(''); this.sendError.set('');
    this.loading.set(!!id);
    if (!id) return;
    let messagesReady = false, requestsReady = false;
    const failed = () => {this.error.set('This conversation could not update. Your typed requirement is still here. Try again when you are connected.'); this.loading.set(false);};
    this.threadSubscriptions.add(this.repository.messages$(id).subscribe({next: items => {
      const element = this.thread?.nativeElement;
      const follow = !element || !messagesReady || element.scrollHeight - element.scrollTop - element.clientHeight < 120;
      this.messages.set(items); messagesReady = true; this.loading.set(!requestsReady);
      if (follow) this.scrollToLatest();
    },error: failed}));
    this.threadSubscriptions.add(this.repository.requests$(id).subscribe({next: items => {this.requests.set(items); requestsReady = true; this.loading.set(!messagesReady);},error: failed}));
  }
  retry(): void { this.error.set(''); this.loadHistory(); this.open(this.conversationId()); }
  async send(): Promise<void> {
    if (this.sending() || !this.requirement.trim()) return;
    const text = this.requirement; this.sending.set(true); this.error.set(''); this.sent.set(''); this.sendError.set('');
    try {
      const id = await this.repository.send(text, this.conversationId() || undefined);
      composerDrafts.delete(this.conversationId()); this.requirement = ''; this.sent.set('Requirement saved. Next agent run: ' + this.nextRunLabel() + '.');
      if (id !== this.conversationId()) await this.router.navigate(['/admin/question-papers/chat', id], {queryParamsHandling:'preserve'});
      this.scrollToLatest();
    } catch (error) { this.sendError.set(error instanceof Error ? error.message : 'Your requirement could not be saved. Try again.'); }
    finally { this.sending.set(false); }
  }
  handleComposerKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void this.send(); }
  }
  goToThread(id: string): void { void this.router.navigate(id ? ['/admin/question-papers/chat', id] : ['/admin/question-papers'], {queryParamsHandling:'preserve'}); }
  async cancel(request: PaperChatRequest): Promise<void> {
    this.actionBusy.set(request.id); this.error.set('');
    try { await this.repository.cancel(request.id); this.sent.set('Request cancelled. You can send a new requirement whenever you are ready.'); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'The request could not be cancelled.'); }
    finally { this.actionBusy.set(''); }
  }
  editRequest(request: PaperChatRequest): void {
    this.requirement = request.brief; this.sent.set('Update the requirement below, then send it to the agent.');
    setTimeout(() => this.composer?.nativeElement.focus(), 0);
  }
  conversationTitle(item: PaperConversation): string { return item.title?.trim() || this.papers().find(paper => paper.conversationId === item.id)?.title?.trim() || 'Untitled paper chat'; }
  requestFor(message: PaperChatMessage): PaperChatRequest | undefined { return message.role !== 'admin' && message.requestId ? this.requests().find(item => item.id === message.requestId) : undefined; }
  paperFor(id: string): ChatSavedPaper | undefined { return this.papers().find(item => item.id === id); }
  briefPreview(request: PaperChatRequest): string { return request.brief.length > 220 ? request.brief.slice(0,220).trimEnd() + '…' : request.brief; }
  canOpenPaper(id: string): boolean { const paper = this.paperFor(id); return !paper || this.isReadyPaper(paper); }
  private isReadyPaper(paper: ChatSavedPaper): boolean { return paper.status === 'ready' || paper.status === 'draft' && !!paper.sections?.length && paper.actualMarks === paper.marks && !paper.coverage?.gapCount; }
  status(status: PaperChatRequest['status']): string { return paperStatusLabels[status]; }
  nextRunLabel(): string { return new Intl.DateTimeFormat('en-IN', {timeZone:'Asia/Kolkata',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}).format(nextPaperRun(new Date(this.clock()))) + ' IST'; }
  date(value: unknown): string {
    const item = value as {toDate?: () => Date; seconds?: number; iso?: string} | undefined;
    const date = item?.toDate?.() ?? (item?.seconds ? new Date(item.seconds * 1000) : new Date(item?.iso ?? String(value ?? '')));
    return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-IN', {day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}).format(date) : 'Just now';
  }
  paperScope(paper: ChatSavedPaper): string { return `${paper.board} · Class ${paper.standard} · ${(paper.subjects ?? []).join(', ')} · ${paper.marks} marks`; }
  paperChapters(paper: ChatSavedPaper): string { return (paper.chapters ?? []).join(', '); }
  async enablePush(): Promise<void> {
    this.actionBusy.set('push'); this.pushMessage.set('');
    try { await this.repository.enablePush(); this.pushMessage.set('Device notifications are enabled. We will notify you when your paper is ready.'); }
    catch (error) { this.pushMessage.set(error instanceof Error ? error.message : 'Device notifications could not be enabled. In-app updates will still appear.'); }
    finally { this.actionBusy.set(''); }
  }
  async openNotification(item: PaperNotification): Promise<void> {
    this.notificationError.set('');
    try { if (!item.read) await this.repository.markRead(item.id); }
    catch { this.notificationError.set('This update could not be marked as read.'); }
    if (item.paperId) await this.router.navigate(['/admin/question-papers/view', item.paperId], {queryParamsHandling:'preserve'});
    else await this.router.navigate(['/admin/question-papers/chat', item.conversationId], {queryParamsHandling:'preserve'});
  }
  private scrollToLatest(): void {
    if (this.scrollTimer) clearTimeout(this.scrollTimer);
    this.scrollTimer = setTimeout(() => {const element = this.thread?.nativeElement; if (element) element.scrollTop = element.scrollHeight;}, 0);
  }
  private rememberDraft(): void { const id = this.conversationId(); if (this.requirement) composerDrafts.set(id,this.requirement); else composerDrafts.delete(id); }
}
