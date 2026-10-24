// Student-copy policy. Apply only to headings/instructions, never questions or answers.
const internalNote=/\b(?:gtop|official|unofficial|syllabus|curriculum|provenance|teacher|review required|markingPoints|correct-option indices|answer fields|question fields|schema|controller|independent (?:content )?review|generated (?:by|using)|AI-generated)\b|आधिकारिक|पाठ्यक्रम|शिक्षक.*समीक्षा/i;
export function examInstruction(value='') {
  return String(value).split(/(?<=[.!?;।])\s+|\n+/u).filter(part=>!internalNote.test(part.replace(/<[^>]*>/g,' '))).join(' ').trim();
}
export function examTitle(value='') {
  return String(value).replace(/,?\s+Version\s+\d+\s*$/i,'').replace(/\s*(?:[—–:,-]\s*)?Custom\s+Practice\s+Paper\b/ig,' Practice Paper').trim();
}
/** Derive a clean view of previously stored, trusted renderer HTML. Originals stay immutable. */
export function cleanExamHtml(html) {
  return html.replace(/<p class="(?:notice|source)">[\s\S]*?<\/p>/gi,'')
    .replace(/(<ol class="instructions">)([\s\S]*?)(<\/ol>)/gi,(_all,start,items,end)=>start+items.replace(/<li>([\s\S]*?)<\/li>/gi,(_item,text)=>{const clean=examInstruction(text);return clean?'<li>'+clean+'</li>':'';})+end)
    .replace(/<p class="section-note">([\s\S]*?)<\/p>/gi,(_item,text)=>{const clean=examInstruction(text);return clean?'<p class="section-note">'+clean+'</p>':'';})
    .replace(/(<h1>)([\s\S]*?)(<\/h1>)/i,(_all,start,title,end)=>start+examTitle(title)+end);
}
