import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';

const width=595,height=842,margin=32;
const black=rgb(.1,.16,.18),accent=rgb(.12,.35,.28);
const plain=value=>String(value??'').normalize('NFKD').replace(/\p{M}/gu,'')
  .replace(/[–—]/gu,'-').replace(/×/gu,'x').replace(/÷/gu,'/')
  .replace(/[^\x20-\x7E\n]/gu,'?');

export async function checkingReport(title,outcome,grade,message,images=[]){
  const doc=await PDFDocument.create();
  doc.setTitle(plain(title)+' - Checking report');
  doc.setAuthor('GT Papers');
  doc.setCreationDate(new Date(0));
  doc.setModificationDate(new Date(0));
  const normal=await doc.embedFont(StandardFonts.Helvetica);
  const bold=await doc.embedFont(StandardFonts.HelveticaBold);
  const draw=(page,value,x,y,size,font=normal,color=black)=>page.drawText(value,{x,y,size,font,color,maxWidth:width-x-margin});
  for(const [index,bytes] of images.entries()){
    const image=await doc.embedJpg(bytes);
    const page=doc.addPage([width,height]);
    const scale=Math.min(440/image.width,740/image.height);
    const w=image.width*scale,h=image.height*scale,x=margin,y=height-65-h;
    const pageNumber=index+1;
    draw(page,'Answer page '+pageNumber,margin,height-39,12,bold);
    page.drawImage(image,{x,y,width:w,height:h});
    const marks=(grade?.answers??[]).flatMap(answer=>{
      const steps=answer.steps.flatMap((step,i)=>step.anchor?.page===pageNumber?
        [{anchor:step.anchor,label:'Q'+answer.number+'.'+(i+1)+' '+(step.awarded??'?')+'/'+step.max}]:[]);
      if(steps.length)return steps;
      return answer.anchors.filter(anchor=>anchor.page===pageNumber)
        .map(anchor=>({anchor,label:'Q'+answer.number+' '+(answer.awarded??'?')+'/'+answer.max}));
    }).sort((a,b)=>a.anchor.y-b.anchor.y);
    const pins=marks.slice(0,60);
    if(pins.length<marks.length)draw(page,'See notes for additional marks.',300,height-39,9);
    const spacing=Math.min(15,740/Math.max(1,pins.length));
    for(const [i,{anchor,label}] of pins.entries()){
      const origin={x:x+w*anchor.x,y:y+h*(1-anchor.y)};
      const labelY=Math.max(margin,height-67-i*spacing);
      page.drawCircle({...origin,size:2.8,borderColor:accent,borderWidth:1});
      page.drawLine({start:{x:x+w+2,y:origin.y},end:{x:483,y:labelY+2},thickness:.45,color:accent});
      draw(page,label,487,labelY,Math.min(8,spacing),bold,accent);
    }
  }
  let page,y;
  const next=()=>{
    page=doc.addPage([width,height]);y=height-42;
    draw(page,'GT Papers | Checking report',margin,y,16,bold,accent);y-=30;
  };
  const paragraph=(value,size=10,font=normal)=>{
    const text=plain(value).replace(/\s+/gu,' ').trim();
    let line='';
    const emit=()=>{
      if(y<margin+size)next();
      if(line)draw(page,line,margin,y,size,font);
      y-=size*1.45;line='';
    };
    for(const word of text.split(' ')){
      const trial=line?line+' '+word:word;
      if(font.widthOfTextAtSize(trial,size)<=width-2*margin){line=trial;continue;}
      if(line)emit();
      for(const ch of word){
        if(font.widthOfTextAtSize(line+ch,size)>width-2*margin)emit();
        line+=ch;
      }
    }
    if(line)emit();
  };
  next();
  paragraph(title,13,bold);
  if(outcome==='complete')paragraph('Final mark: '+grade.awarded+' / '+grade.max,12,bold);
  else {
    paragraph(outcome==='partial'?'Partial assessment | No final mark':'Unable to assess | No final mark',12,bold);
    if(grade?.answers.some(answer=>answer.counted===true&&answer.awarded!==null))
      paragraph('Assessed marks counted so far: '+grade.awarded+'. The paper maximum is '+grade.max+'.');
  }
  if(message)paragraph(message);
  y-=9;
  for(const answer of grade?.answers??[]){
    if(y<100)next();
    const status=answer.status==='missing'?'unattempted':answer.status;
    const label=answer.awarded===null?'mark not determined':answer.awarded+' / '+answer.max;
    const counted=answer.counted===false?' | excluded':answer.counted===null?' | selection unresolved':'';
    paragraph('Q'+answer.number+' | '+status+' | '+label+counted,11,bold);
    paragraph(answer.explanation);
    for(const [i,step] of answer.steps.entries())
      paragraph('Q'+answer.number+'.'+(i+1)+' '+step.criterion+' | '+(step.awarded??'?')+' / '+step.max+' | '+step.comment,9);
    y-=8;
  }
  return Buffer.from(await doc.save());
}
