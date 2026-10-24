import katex from 'katex';
import 'katex/contrib/mhchem';

export function escapeChatText(value) {
  return String(value ?? '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

export function protectMathSources(value) {
  const original=String(value ?? '');
  let prefix='\uE000gtop-math-';while(original.includes(prefix))prefix+='_';
  const sources=[];
  const text=original.replace(/(?<!\\)(\$\$[\s\S]*?(?<!\\)\$\$|\$(?:\\.|[^$\n])*?(?<!\\)\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g,source=>{
    const token=prefix+sources.length+'\uE001';sources.push(source);return token;
  });
  return {text,restore(html){for(let i=0;i<sources.length;i++)html=html.split(prefix+i+'\uE001').join('<span class="assistant-math-source">'+escapeChatText(sources[i])+'</span>');return html;}};
}

export function renderAssistantFormula(raw) {
  const source=String(raw ?? '');
  const fallback={html:escapeChatText(source),valid:false,display:false};
  let tex,display=false;
  if(source.startsWith('$$')&&source.endsWith('$$')&&source.length>=4){tex=source.slice(2,-2);display=true;}
  else if(source.startsWith('\\[')&&source.endsWith('\\]')){tex=source.slice(2,-2);display=true;}
  else if(source.startsWith('\\(')&&source.endsWith('\\)'))tex=source.slice(2,-2);
  else if(source.startsWith('$')&&source.endsWith('$')&&source.length>=2)tex=source.slice(1,-1);
  else return fallback;
  if(!tex.trim()||tex.length>2000||/\\(?:href|url|includegraphics|htmlClass|htmlId|htmlStyle|htmlData)\b/.test(tex))return fallback;
  try{
    const html=katex.renderToString(tex,{displayMode:display,trust:false,strict:'error',throwOnError:true,maxExpand:200,maxSize:12,macros:{},output:'htmlAndMathml'});
    return html.length>100000?fallback:{html,valid:true,display};
  }catch{return fallback;}
}
