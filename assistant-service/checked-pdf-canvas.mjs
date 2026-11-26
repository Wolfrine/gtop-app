import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {buildInkMap} from './domain/checked-return-pdf.mjs';

const fontDirectory=new URL('./assets/checking-fonts/',import.meta.url);
let nativeCanvas,fontFamilies,activeInkMaps=0;

export async function checkedPdfCanvas(){
  const {createCanvas,loadImage,GlobalFonts}=await (nativeCanvas??=import('@napi-rs/canvas'));
  // Reuse one scratch surface. Each scan is reduced to the legacy mask resolution.
  const canvas=createCanvas(1,1);
  let families;
  const text=(size,bold)=>{
    if(!families)throw Error('Checked report fonts are unavailable.');
    const context=canvas.getContext('2d');
    context.font=(bold?'700 ':'400 ')+size+'px '+families;
    context.textBaseline='alphabetic';
    return context;
  };
  const reset=()=>{canvas.width=1;canvas.height=1;};
  families=await (fontFamilies??=(async()=>{
    const sources=JSON.parse(await readFile(new URL('sources.json',fontDirectory),'utf8'));
    return sources.map(({file},i)=>{
      const family='GT Papers Noto '+i;
      if(!GlobalFonts.registerFromPath(fileURLToPath(new URL(file,fontDirectory)),family))
        throw Error('A bundled checked report font could not be loaded.');
      return '"'+family+'"';
    }).join(', ')+', sans-serif';
  })());

  return {
    textFallback:{
      measure(value,size,bold){return text(size,bold).measureText(value).width;},
      rasterize(value,size,bold,color){
        try{
          const scale=3;
          const width=Math.ceil(text(size*scale,bold).measureText(value).width)+4*scale;
          const height=Math.ceil(size*scale*1.7);
          canvas.width=width;canvas.height=height;
          const context=text(size*scale,bold);
          context.fillStyle='rgb('+[color.red,color.green,color.blue].map(c=>Math.round(c*255)).join(',')+')';
          context.fillText(value,2*scale,size*scale*1.05);
          return {bytes:canvas.encodeSync('png'),width:width/scale,height:height/scale};
        }finally{reset();}
      }
    },
    async scanInk(bytes){
      if(activeInkMaps>=2)return null;
      activeInkMaps++;
      let retained=false;
      try{
        const image=await loadImage(bytes);
        if(!image.width||!image.height)return null;
        const ratio=Math.min(1,1600/Math.max(image.width,image.height));
        const width=Math.max(1,Math.round(image.width*ratio));
        const height=Math.max(1,Math.round(image.height*ratio));
        canvas.width=width;canvas.height=height;
        const context=canvas.getContext('2d');
        context.drawImage(image,0,0,width,height);
        const map=buildInkMap(context.getImageData(0,0,width,height).data,width,height);
        let released=false;
        map.release=()=>{
          if(released)return;
          released=true;
          map.occupied=null;
          activeInkMaps--;
        };
        retained=true;
        return map;
      }catch{
        // The original layout keeps every mark in the gutter when no ink map is available.
        return null;
      }finally{
        reset();
        if(!retained)activeInkMaps--;
      }
    }
  };
}
