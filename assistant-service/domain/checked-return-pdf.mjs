import {gutterOrigin,inkAwareMarks,marginGroups,pagePins} from './checked-return-marks.mjs';
export {buildInkMap} from './checked-return-marks.mjs';

const pageWidth=595.28,pageHeight=841.89,margin=30;
const statusText={correct:'Correct',partial:'Partial credit',wrong:'Incorrect',missing:'Unattempted',
  unreadable:'Unreadable',uncertain:'Uncertain'};
const graphemes=new Intl.Segmenter(undefined,{granularity:'grapheme'});
const numericScore=(value,max)=>`${value??'?'} / ${max}`;

function identity(sheet){
  const name=sheet.studentLabel||sheet.label||'';
  const reference=sheet.studentUid?'GT '+sheet.studentUid.slice(-6):'';
  const label=!sheet.labelFromStudent&&sheet.label!==name?sheet.label:'';
  return {name,reference,label,full:[name,reference,reference&&label].filter(Boolean).join(' · ')};
}

class PdfText {
  constructor(doc,normal,bold,fallback,ink){
    this.doc=doc;
    this.normal=normal;
    this.bold=bold;
    this.fallback=fallback;
    this.ink=ink;
    this.characters=new Set(normal.getCharacterSet());
  }
  supports(value){return [...value].every(char=>this.characters.has(char.codePointAt(0)));}
  width(value,size,bold=false){
    return this.supports(value)?(bold?this.bold:this.normal).widthOfTextAtSize(value,size):
      this.fallback.measure(value,size,bold);
  }
  wrap(value,width,size,bold=false){
    const lines=[];
    for(const paragraph of value.replace(/\r\n?/g,'\n').split('\n')){
      let current='';
      for(const word of paragraph.trim().split(/\s+/u)){
        const next=current?current+' '+word:word;
        if(this.width(next,size,bold)<=width){current=next;continue;}
        if(current){lines.push(current);current='';}
        for(const {segment:char} of graphemes.segment(word)){
          if(current&&this.width(current+char,size,bold)>width){lines.push(current);current='';}
          current+=char;
        }
      }
      lines.push(current);
    }
    return lines;
  }
  short(value,width,size,bold=false){
    if(this.width(value,size,bold)<=width)return value;
    if(width<=this.width('…',size,bold))return '';
    const first=this.wrap(value,width-this.width('…',size,bold),size,bold)[0];
    return first.trimEnd()+'…';
  }
  async write(page,value,x,top,size,bold=false,color=this.ink){
    if(!value)return;
    if(this.supports(value)){
      page.drawText(value,{x,y:pageHeight-top-size,size,font:bold?this.bold:this.normal,color});
      return;
    }
    const {bytes,width,height}=await this.fallback.rasterize(value,size,bold,color);
    const image=await this.doc.embedPng(bytes);
    page.drawImage(image,{x:x-2,y:pageHeight-top-height,width,height});
  }
}

function markSymbol(page,status,x,top,colors){
  const y=pageHeight-top,color=colors[status];
  const stroke=(x1,y1,x2,y2)=>page.drawLine({start:{x:x+x1,y:y-y1},end:{x:x+x2,y:y-y2},color,thickness:1.1});
  if(status==='correct'){
    stroke(0,4,2.2,6.3);
    stroke(2.2,6.3,6.5,0);
  }else if(status==='wrong'){
    stroke(0.5,0.5,5.5,6);
    stroke(5.5,0.5,0.5,6);
  }else if(status==='partial'){
    page.drawCircle({x:x+3.2,y:y-3.4,size:2.8,borderWidth:0.8,borderColor:color});
    stroke(1.2,5.5,5.2,1.3);
  }else stroke(0.5,3,6,3);
}

async function header(page,text,view,section){
  const {title,classLabel,recipient,total,coverage,muted,line}=view;
  await text.write(page,text.short(title,pageWidth-margin*2,15,true),margin,margin,15,true);
  const extra=classLabel?15:0;
  if(classLabel)await text.write(page,text.short(classLabel,pageWidth-margin*2,9),margin,margin+23,9,false,muted);
  const totalWidth=text.width(total,10,true);
  await text.write(page,total,pageWidth-margin-totalWidth,margin+24+extra,10,true);
  const rest=pageWidth-margin*2-totalWidth-16;
  const recipientName=recipient.reference&&recipient.name?'GTOP recipient · '+recipient.name:recipient.name;
  const nameAndLabel=[recipientName,recipient.reference&&recipient.label].filter(Boolean).join(' · ');
  const suffix=[recipient.reference,section].filter(Boolean).map(part=>'  ·  '+part).join('');
  const trail=nameAndLabel?suffix:[recipient.reference,section].filter(Boolean).join('  ·  ');
  const recipientLine=text.short(nameAndLabel,rest-text.width(trail,10),10)+trail;
  await text.write(page,recipientLine,margin,margin+24+extra,10,false,muted);
  if(coverage)await text.write(page,coverage,pageWidth-margin-text.width(coverage,8),margin+35+extra,8,false,muted);
  page.drawLine({start:{x:margin,y:pageHeight-74-extra},end:{x:pageWidth-margin,y:pageHeight-74-extra},
    color:line,thickness:0.6});
}

async function annotate(page,text,pins,x,top,width,height,notesX,inkMap,colors,white){
  const marks=pins.map(pin=>({answer:pin,anchor:pin.anchor}));
  const labelFor=pin=>pin.id+'  '+pin.score.replace(/ /g,'');
  const positions=inkAwareMarks(marks,width,height,({answer})=>({width:text.width(labelFor(answer),7.2,true)+15,height:10.7}),inkMap);
  const marginOnly=new Set();
  for(const position of positions){
    const pin=position.answer;
    const px=x+width*position.left/100,py=top+height*position.top/100;
    if(position.placement==='margin'){marginOnly.add(pin);continue;}
    const label=labelFor(pin);
    const boxWidth=text.width(label,7.2,true)+15;
    const ax=x+pin.anchor.x*width,ay=top+pin.anchor.y*height;
    const sideX=Math.max(px,Math.min(px+boxWidth,ax)),sideY=Math.max(py,Math.min(py+10.7,ay));
    const gap=Math.hypot(sideX-ax,sideY-ay);
    if(gap>2){
      const stopX=ax+(sideX-ax)*1.6/gap,stopY=ay+(sideY-ay)*1.6/gap;
      page.drawLine({start:{x:sideX,y:pageHeight-sideY},end:{x:stopX,y:pageHeight-stopY},
        color:colors[pin.status],thickness:0.55,opacity:0.68});
    }
    page.drawRectangle({x:px,y:pageHeight-py-10.7,width:boxWidth,height:10.7,color:white,
      opacity:0.95,borderColor:colors[pin.status],borderWidth:0.55});
    markSymbol(page,pin.status,px+2.2,py+2,colors);
    await text.write(page,label,px+11,py+1,7.2,true,colors[pin.status]);
  }
  // A short crop can use the remaining gutter height before adjacent notes must be grouped.
  const notesHeight=Math.max(height,Math.min(pageHeight-top-margin,marks.length*32));
  const notes=marks.map(mark=>({...mark,anchor:{...mark.anchor,y:mark.anchor.y*height/notesHeight}}));
  const groups=marginGroups(notes,notesHeight,32);
  const gutterWidth=pageWidth-margin-notesX;
  for(const [i,group] of groups.entries()){
    const pin=group.marks[0].answer;
    const share=Math.min(2*group.center,2*(1-group.center),i?group.center-groups[i-1].center:1,
      i+1<groups.length?groups[i+1].center-group.center:1)*notesHeight;
    const maxLines=Math.min(10,Math.max(0,Math.floor((share-11)/8.3)));
    const heading=pin.id+'  '+pin.score+(group.marks.length>1?' +'+(group.marks.length-1):'');
    let caption=text.wrap(pin.comment,gutterWidth,7.1);
    if(caption.length>maxLines&&pin.status!=='correct'){
      const last=pin.comment.trim().split(/(?<=[.!?।])\s+/u).pop();
      if(last&&last!==pin.comment)caption=text.wrap(last,gutterWidth,7.1);
    }
    if(caption.length>maxLines){
      caption=caption.slice(0,maxLines);
      if(caption.length)caption[caption.length-1]=text.short(caption[caption.length-1]+'…',gutterWidth,7.1);
    }
    const start=top+group.center*notesHeight-(10+caption.length*8.3)/2;
    for(const {answer} of group.marks){
      if(!marginOnly.has(answer))continue;
      const edge=x+width,pinY=pageHeight-top-answer.anchor.y*height;
      const origin=x+gutterOrigin(inkMap,answer.anchor,width,height);
      if(origin<edge)page.drawLine({start:{x:origin,y:pinY},end:{x:edge,y:pinY},
        color:colors[answer.status],thickness:0.55,opacity:0.65});
      page.drawLine({start:{x:edge,y:pinY},end:{x:notesX-1,y:pageHeight-start-5},
        color:colors[answer.status],thickness:0.55});
    }
    markSymbol(page,pin.status,notesX,start+1.2,colors);
    await text.write(page,heading,notesX+9,start,8,true,colors[pin.status]);
    for(const [j,value] of caption.entries())await text.write(page,value,notesX,start+10+j*8.3,7.1);
  }
}

/**
 * @param {{pdfLib: any, detail: any, pages: Uint8Array[], outcome?: string,
 *  assessedAwarded?: number|null, assessedMax?: number|null, message?: string|null,
 *  scanInk?: (bytes: Uint8Array) => any, textFallback: {
 *    measure: (value: string, size: number, bold: boolean) => number,
 *    rasterize: (value: string, size: number, bold: boolean, color: {red:number,green:number,blue:number}) => any
 *  }, assertCurrent?: () => void}} input
 * @returns {Promise<Uint8Array>}
 */
export async function renderCheckedReturn({pdfLib,detail,pages,outcome='complete',assessedAwarded=null,
  assessedMax=null,message=null,scanInk,textFallback,assertCurrent=()=>{}}){
  const {PDFDocument,StandardFonts,rgb}=pdfLib;
  const {sheet,rubric}=detail;
  const grade=sheet.grade;
  if(outcome==='complete'&&(!grade||grade.pending||!Number.isFinite(grade.awarded)))
    throw Error('This sheet is still awaiting final marks.');
  const scans=[...(sheet.uploaded??[])].sort((a,b)=>a.index-b.index);
  if(pages.length&&(pages.length!==sheet.pageCount||scans.length!==pages.length||
    scans.some((scan,i)=>scan.index!==i+1||!scan.width||!scan.height)))throw Error('The saved scans are incomplete.');
  assertCurrent();
  const doc=await PDFDocument.create();
  const recipient=identity(sheet);
  const complete=outcome==='complete';
  doc.setTitle([rubric.title,recipient.full].filter(Boolean).join(' — '));
  doc.setAuthor('GT Papers');
  doc.setSubject(complete?'Final checked answer sheet':outcome==='partial'?'Partial checked answer sheet':'Checking report');
  doc.setCreationDate(new Date(0));
  doc.setModificationDate(new Date(0));
  const ink=rgb(0.09,0.15,0.19),muted=rgb(0.26,0.32,0.35),white=rgb(1,1,1);
  const colors={correct:rgb(0.04,0.4,0.27),partial:rgb(0.57,0.31,0.05),wrong:rgb(0.68,0.12,0.13),
    missing:muted,unreadable:muted,uncertain:muted};
  const text=new PdfText(doc,await doc.embedFont(StandardFonts.Helvetica),await doc.embedFont(StandardFonts.HelveticaBold),textFallback,ink);
  const paperMax=grade?.max??rubric.marks;
  const covered=assessedMax??grade?.assessedMax;
  const earned=assessedAwarded??(covered>0?grade?.awarded:null);
  const coverage=!complete&&Number.isFinite(paperMax)?[
    ...(Number.isFinite(earned)&&covered>0?['Assessed '+numericScore(earned,covered)]:[]),
    'Full paper maximum: '+paperMax,
  ].join('  ·  '):'';
  const classLabel=detail.classLabel??(sheet.singleStudentBook?'':sheet.packetLabel||'');
  const view={title:rubric.title,classLabel,recipient,muted,line:rgb(0.81,0.84,0.84),coverage,
    total:complete?'Final  '+numericScore(grade.awarded,grade.max):outcome==='partial'?'Partial assessment':'Unable to assess'};
  for(const [i,bytes] of pages.entries()){
    assertCurrent();
    const scan=scans[i];
    const image=await doc.embedJpg(bytes);
    if(image.width!==scan.width||image.height!==scan.height)
      throw Error('A saved scan changed. Refresh the sheet before downloading.');
    const page=doc.addPage([pageWidth,pageHeight]);
    await header(page,text,view,`Page ${scan.index} / ${pages.length}`);
    const pins=pagePins(grade?.answers??[],scan.index,numericScore);
    const available=pageWidth-margin*2-(pins.length?111:0),top=classLabel?103:88;
    const ratio=Math.min(available/scan.width,(pageHeight-top-margin)/scan.height);
    const width=scan.width*ratio,height=scan.height*ratio;
    const x=margin+(available-width)/2;
    page.drawImage(image,{x,y:pageHeight-top-height,width,height});
    if(pins.length){
      const inkMap=await scanInk?.(bytes);
      try{
        assertCurrent();
        await annotate(page,text,pins,x,top,width,height,margin+available+8,inkMap,colors,white);
      }finally{inkMap?.release?.();}
    }
  }

  let page,y;
  const next=async()=>{
    assertCurrent();
    page=doc.addPage([pageWidth,pageHeight]);
    await header(page,text,view,'Marking notes');
    y=classLabel?106:91;
  };
  await next();
  const fit=(value,size,bold=false,indent=0,color=ink)=>({
    lines:text.wrap(value,pageWidth-margin*2-indent,size,bold),size,bold,indent,color
  });
  const heightOf=rows=>rows.reduce((sum,row)=>sum+row.lines.length*row.size*1.48,0);
  const atBottom=pageHeight-margin;
  const room=atBottom-(classLabel?106:91);
  const keep=async height=>{
    if(y+height+1>atBottom&&height<room)await next();
  };
  const paragraph=async(...rows)=>{
    await keep(heightOf(rows));
    for(const {lines,size,bold,indent,color} of rows){
      for(const line of lines){
        if(y+size*1.5>atBottom)await next();
        await text.write(page,line,margin+indent,y,size,bold,color);
        y+=size*1.48;
      }
    }
  };
  if(message){await paragraph(fit(message,9.5,false,0,muted));y+=12;}
  for(const [index,section] of (grade?.sections??[]).entries()){
    if(section.attemptCount>=section.questionNumbers.length)continue;
    const sectionTitle=section.title||'Section '+(index+1);
    const counted=(section.countedNumbers??[]).map(number=>'Q'+number).join(', ');
    const decision=section.needsSelection?' · Counted attempts unresolved':counted?' · Counted '+counted:'';
    const parts=[fit(sectionTitle+' · Choose '+section.attemptCount+' of '+section.questionNumbers.length+decision,9.5,true)];
    if(section.missingToConfirm)parts.push(fit('Unconfirmed unattempted slots: '+section.missingToConfirm,9,false,0,muted));
    await paragraph(...parts);
    y+=7;
  }
  for(const answer of grade?.answers??[]){
    const description=[`Q${answer.number}`,statusText[answer.status],numericScore(answer.awarded,answer.max)];
    if(answer.choice)description.push('Option '+answer.choice);
    if(answer.counted===false)description.push('Excluded from total');
    if(answer.counted===null)description.push('Counted attempt unresolved');
    if(answer.anchors.length)description.push('p. '+[...new Set(answer.anchors.map(anchor=>anchor.page))].join(', '));
    const notes=[[fit(description.join('  ·  '),11,true),fit(answer.explanation,9.5)]];
    for(const [i,step] of (answer.steps??[]).entries()){
      const part=[fit(`Q${answer.number}.${i+1}  ${step.criterion}  ·  ${numericScore(step.awarded,step.max)}`,9,true,8)];
      if(step.comment)part.push(fit(step.comment,9,false,8));
      notes.push(part);
    }
    if(answer.evidence)notes.push([fit('Q'+answer.number+' evidence: '+answer.evidence,8.8,false,0,muted)]);
    await keep(heightOf(notes.flat())+(notes.length-1)*3);
    for(const [i,part] of notes.entries()){
      if(i)y+=3;
      await paragraph(...part);
    }
    y+=12;
  }
  assertCurrent();
  return doc.save({objectsPerTick:30});
}
