import {Component, EventEmitter, Input, OnDestroy, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {packetFilePageCount, previewPacketPage, scanBase64, type Scan} from './checking-intake';

export type ScanCorrection = {
  op:'append'|'replace'|'identify'|'move';
  requestId:string;
  page?:number;
  bookId?:string;
  targetBookId?:string;
  groupIndex?:number;
  jpeg?:string;
  label?:string;
};

@Component({
  selector:'gtop-packet-correction', standalone:true, imports:[FormsModule],
  templateUrl:'./packet-correction.html',styleUrl:'./paper-packet.css'
})
export class PacketCorrectionComponent implements OnDestroy {
  @Input() page=0;
  @Input() bookId='';
  @Input() groupIndex=-1;
  @Input() bookLabel='';
  @Input() submitted=false;
  @Input() held=false;
  @Input() busy=false;
  @Input() canAppend=true;
  @Input() canMove=false;
  @Input() lastPage=false;
  @Input() destinations:{label:string;sheetId?:string;withdrawn?:boolean}[]=[];
  @Output() apply=new EventEmitter<ScanCorrection>();
  @Output() selection=new EventEmitter<boolean>();

  op:ScanCorrection['op']|''='';
  target='';
  identity='';
  file?:File;
  preview?:Scan;
  reading=false;
  error='';
  private turns=0;
  private epoch=0;
  private requestId='';
  private lastSignature='';
  private frozenPage=0;
  private frozenBook='';
  private frozenIndex=-1;

  start(op:ScanCorrection['op']) {
    if(this.busy)return;
    this.reset();this.op=op;this.frozenPage=this.page;this.frozenBook=this.bookId;this.frozenIndex=this.groupIndex;
    this.selection.emit(true);
  }
  get correctionPage(){return this.frozenPage;}
  async pick(event:Event) {
    const input=event.target as HTMLInputElement,file=input.files?.[0];input.value='';
    if(!file||this.busy)return;
    this.file=file;this.turns=0;await this.read();
  }
  rotate(){if(this.reading||this.busy)return;this.turns=(this.turns+1)%4;void this.read();}
  private async read(){
    const file=this.file;if(!file)return;
    const epoch=++this.epoch;this.reading=true;this.error='';this.release();
    try {
      if(await packetFilePageCount(file)!==1)throw Error('Select one photo or a one-page PDF for this correction.');
      const scan=await previewPacketPage(file,1,this.turns);
      if(epoch===this.epoch)this.preview=scan;else URL.revokeObjectURL(scan.url);
    }catch(e){if(epoch===this.epoch)this.error=e instanceof Error?e.message:'Could not open the scan.';}
    finally{if(epoch===this.epoch)this.reading=false;}
  }
  async submit(){
    if(!this.op||this.busy||this.reading)return;
    this.error='';
    const op=this.op;
    if((op==='replace'||op==='append')&&!this.preview)return;
    const result:ScanCorrection={op,requestId:''};
    if(this.submitted)result.bookId=this.frozenBook;
    if(op==='replace'||op==='move')result.page=this.frozenPage;
    if(op==='append'&&!this.submitted)result.groupIndex=this.frozenIndex;
    if(op==='identify'){result.label=this.identity.trim();if(!result.label)return;}
    if(op==='move'){result.targetBookId=this.target;if(!result.targetBookId)return;}
    this.reading=true;
    try{
      if(this.preview)result.jpeg=await scanBase64(this.preview.blob);
      // The same request id may be retried after a network response is lost.
      const signature=JSON.stringify([op,result.page,result.bookId,result.targetBookId,result.groupIndex,result.label,this.preview?.url]);
      if(signature!==this.lastSignature){this.lastSignature=signature;this.requestId=crypto.randomUUID();}
      result.requestId=this.requestId;
      this.apply.emit(result);
    }catch(e){this.error=e instanceof Error?e.message:'Could not read the correction.';}
    finally{this.reading=false;}
  }
  reset(){
    this.epoch++;this.release();this.file=undefined;this.reading=false;this.error='';this.identity='';
    this.target='';this.op='';this.requestId='';this.lastSignature='';this.selection.emit(false);
  }
  private release(){if(this.preview)URL.revokeObjectURL(this.preview.url);this.preview=undefined;}
  ngOnDestroy(){this.epoch++;this.release();}
}
