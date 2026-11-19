export type Scan = { name:string; blob:Blob; url:string };
const pageLimit=12, edgeLimit=2200, byteLimit=400000;
const acceptedImages=/\.(jpe?g|png|webp|avif|heic|heif)$/i;

function frame(width:number,height:number){
  const canvas=document.createElement('canvas');
  const scale=Math.min(1,edgeLimit/Math.max(width,height));
  canvas.width=Math.ceil(width*scale);
  canvas.height=Math.ceil(height*scale);
  const context=canvas.getContext('2d',{alpha:false});
  if(!context||Math.min(canvas.width,canvas.height)<64)throw Error('The page is too small to check.');
  context.fillStyle='#fff';
  context.fillRect(0,0,canvas.width,canvas.height);
  return {canvas,context};
}

async function encode(canvas:HTMLCanvasElement,name:string):Promise<Scan>{
  for(const quality of [.91,.82,.72,.62,.52]){
    const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
    if(blob&&blob.size<=byteLimit)return {name,blob,url:URL.createObjectURL(blob)};
  }
  throw Error('This page could not be compressed clearly. Crop to the answer sheet and try again.');
}

export async function scanFiles(files:File[],available:number):Promise<Scan[]>{
  const pages:Scan[]=[];
  const ensureSpace=(count:number)=>{
    if(pages.length+count>Math.min(pageLimit,available))throw Error('Add up to 12 pages per answer sheet.');
  };
  try{
    for(const file of files){
      if(file.size>30_000_000)throw Error('Choose files smaller than 30 MB.');
      if(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')){
        const pdf=await import('pdfjs-dist');
        pdf.GlobalWorkerOptions.workerSrc='/pdf-engine/pdf.worker.min.mjs';
        const task=pdf.getDocument({data:await file.arrayBuffer(),isEvalSupported:false,useWasm:false,
          cMapUrl:'/pdf-engine/cmaps/',cMapPacked:true,standardFontDataUrl:'/pdf-engine/standard_fonts/',
          maxImageSize:35_000_000,enableXfa:false});
        try{
          const document=await task.promise;
          ensureSpace(document.numPages);
          for(let index=1;index<=document.numPages;index++){
            const page=await document.getPage(index);
            const original=page.getViewport({scale:1});
            const scale=edgeLimit/Math.max(original.width,original.height);
            const viewport=page.getViewport({scale});
            const {canvas,context}=frame(viewport.width,viewport.height);
            await page.render({canvas,canvasContext:context,viewport,annotationMode:pdf.AnnotationMode.DISABLE}).promise;
            pages.push(await encode(canvas,file.name+' · '+index));
            canvas.width=0;
            page.cleanup();
          }
        }finally{await task.destroy();}
        continue;
      }
      ensureSpace(1);
      if(!/^image\/(jpeg|png|webp|avif|heic|heif)$/.test(file.type)&&!acceptedImages.test(file.name))
        throw Error('Choose a photo or scanned PDF.');
      const image=await createImageBitmap(file).catch(()=>{throw Error('This photo could not be read. Save it as JPEG or PNG and try again.');});
      try{
        const {canvas,context}=frame(image.width,image.height);
        context.drawImage(image,0,0,canvas.width,canvas.height);
        pages.push(await encode(canvas,file.name));
        canvas.width=0;
      }finally{image.close();}
    }
    return pages;
  }catch(error){
    for(const page of pages)URL.revokeObjectURL(page.url);
    throw error;
  }
}

export function scanBase64(blob:Blob):Promise<string>{
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result).split(',')[1]);
    reader.onerror=()=>reject(Error('This scan page could not be read.'));
    reader.readAsDataURL(blob);
  });
}
