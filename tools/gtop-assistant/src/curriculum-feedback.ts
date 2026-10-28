/** Research details remain in private job evidence. Chat needs the actual blocker. */
export function incompleteCurriculumReply(value:any,_board:string){
  const reply=String(value.reply||'I couldn’t verify this syllabus. Please share the textbook or chapter outline.').trim();
  if(reply.length<=600)return reply;
  const sentences=reply.match(/[^!?。]+[!?。]|[^.!?]+\.(?=\s|$)/g)||[];
  const short=sentences.filter(s=>s.length<=600).slice(0,2).join(' ').trim();
  return short&&short.length<=600?short:'I couldn’t verify this syllabus. Please share the textbook or chapter outline so I can continue.';
}
