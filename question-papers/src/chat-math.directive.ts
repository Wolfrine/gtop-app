import {AfterViewInit,Directive,ElementRef,Input,OnChanges,OnDestroy,inject} from '@angular/core';
import {renderAssistantFormula} from './chat-math.mjs';

@Directive({selector:'[assistantMath]',standalone:true})
export class ChatMathDirective implements AfterViewInit,OnChanges,OnDestroy {
  @Input() assistantMath='';
  private host=inject<ElementRef<HTMLElement>>(ElementRef);
  private destroyed=false;
  ngAfterViewInit(){this.schedule();}
  ngOnChanges(){this.schedule();}
  ngOnDestroy(){this.destroyed=true;}
  private schedule(){queueMicrotask(()=>{if(!this.destroyed)this.render();});}
  private render(){
    for(const element of Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.assistant-math-source'))){
      if(element.dataset['mathRendered'])continue;
      const result=renderAssistantFormula(element.textContent || '');
      // Only KaTeX-generated bounded HTML (or escaped literal fallback) enters here.
      // Model prose has already passed Angular's ordinary HTML sanitizer.
      element.innerHTML=result.html;
      element.dataset['mathRendered']='1';
      if(result.valid){
        element.classList.add('assistant-formula');
        if(result.display)element.classList.add('display-math');
        const focus=()=>{if(this.destroyed||!element.isConnected)return;if(element.scrollWidth>element.clientWidth+1){element.tabIndex=0;element.setAttribute('aria-label','Scrollable formula');}};
        focus();void document.fonts?.ready.then(focus);
      }
    }
  }
}
