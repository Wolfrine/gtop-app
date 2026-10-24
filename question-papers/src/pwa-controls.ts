import {CommonModule} from '@angular/common';
import {Component,ElementRef,HostListener,OnDestroy,ViewChild,inject} from '@angular/core';
import {SwUpdate} from '@angular/service-worker';
import {Subscription} from 'rxjs';

interface InstallEvent extends Event {prompt():Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>;}

@Component({selector:'gt-pwa-controls',standalone:true,imports:[CommonModule],template:`
  <div class="pwa-controls">
    <span *ngIf="offline" class="pwa-offline" role="status" title="Reconnect to load conversations and request papers.">Offline</span>
    <button *ngIf="updateReady" #installAction type="button" class="pwa-action" (click)="update()">Update app</button>
    <button *ngIf="!installed&&!updateReady" #installAction type="button" class="pwa-action" (click)="install()" aria-label="Install GT Papers" [attr.aria-expanded]="help"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4"/></svg><span>Install</span></button>
    <section *ngIf="help||notice" class="pwa-help" role="status" aria-label="App installation">
      <button type="button" class="pwa-close" aria-label="Close installation help" (click)="close()">×</button>
      <strong>{{notice?'Before updating':'GT Papers, one tap away'}}</strong>
      <p *ngIf="notice">{{notice}}</p>
      <p *ngIf="help&&!notice">{{ios?'In Safari, open Share and choose Add to Home Screen.':'Use your browser’s Install app option. On mobile, look in the browser menu for Add to Home Screen.'}}</p>
      <small *ngIf="help&&!notice">Conversations and paper creation need an internet connection.</small>
    </section>
  </div>
`,styles:[`
  :host{display:inline-flex;flex-shrink:0}.pwa-controls{position:relative;display:flex;align-items:center;gap:8px}.pwa-action{font:inherit;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:8px 10px;background:transparent;color:inherit;border:1px solid #d8e2df;border-radius:8px;cursor:pointer}.pwa-action:hover{background:#edf3f0}.pwa-action:focus-visible,.pwa-close:focus-visible{outline:2px solid #147c69;outline-offset:3px}.pwa-offline{font-size:12px;color:#98621b}.pwa-help{position:absolute;right:0;top:calc(100% + 9px);z-index:80;width:min(300px,calc(100vw - 32px));padding:18px 38px 18px 18px;border:1px solid #dce4df;border-radius:12px;background:#fff;box-shadow:0 10px 30px #12343b18;color:#203b40;line-height:1.5}.pwa-help strong{font-size:14px}.pwa-help p{font-size:13px;margin:8px 0}.pwa-help small{font-size:12px;color:#647570}.pwa-close{position:absolute;top:4px;right:3px;min-height:36px;min-width:36px;border:0;background:transparent;font-size:22px;color:#506661;cursor:pointer}@media(max-width:640px){.pwa-action{min-height:44px;min-width:44px;padding:9px}.pwa-action span{display:none}.pwa-offline{font-size:11px}.pwa-close{min-width:44px;min-height:44px}.pwa-help{position:fixed;top:66px;right:16px}}
`]})
export class GtPwaControls implements OnDestroy {
  @ViewChild('installAction') installAction?:ElementRef<HTMLButtonElement>;
  private sw=inject(SwUpdate);private pending?:InstallEvent;private subscriptions:Subscription[]=[];
  installed=matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;
  ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  offline=!navigator.onLine;help=false;notice='';updateReady=false;
  constructor(){
    if(this.sw.isEnabled){this.subscriptions.push(this.sw.versionUpdates.subscribe(event=>{if(event.type==='VERSION_READY')this.updateReady=true;}));this.subscriptions.push(this.sw.unrecoverable.subscribe(()=>this.updateReady=true));}
  }
  @HostListener('window:beforeinstallprompt',['$event']) onPrompt(event:Event){event.preventDefault();this.pending=event as InstallEvent;}
  @HostListener('window:appinstalled') onInstalled(){this.installed=true;this.pending=undefined;this.help=false;}
  @HostListener('window:online') online(){this.offline=false;}
  @HostListener('window:offline') wentOffline(){this.offline=true;}
  @HostListener('window:keydown.escape') close(){const wasOpen=this.help||!!this.notice;this.help=false;this.notice='';if(wasOpen)this.installAction?.nativeElement.focus();}
  async install(){
    this.notice='';if(!this.pending){this.help=!this.help;return;}
    const event=this.pending;this.pending=undefined;
    try{await event.prompt();const choice=await event.userChoice;if(choice.outcome==='accepted')this.help=false;}catch{this.help=true;}
  }
  update(){
    if(document.querySelector<HTMLTextAreaElement>('#message-input')?.value.trim()){this.notice='Send your message or clear the draft before updating. Your draft has not been changed.';return;}
    location.reload();
  }
  ngOnDestroy(){this.subscriptions.forEach(s=>s.unsubscribe());}
}
