import {curriculum,paperSchema,revisionSchema} from '../../../assistant-service/domain/index.mjs';

// The specialist must copy controller-owned identifiers, rather than inventing
// source IDs or combining chapter labels. The gateway still validates results.
export function outputSchemas(pinned:any){
  const chapter={type:'string',enum:pinned.chapters.map((c:any)=>c.title)};
  const paper=structuredClone(paperSchema);paper.properties.sections.items.properties.questions.items.properties.chapter=chapter;
  const source=paper.properties.sourceReferences.items.properties;source.id={type:'string',enum:[pinned.id]};source.url={type:'string',enum:[pinned.url]};
  const revision=structuredClone(revisionSchema);revision.properties.question.properties.chapter=chapter;
  return {paper,revision};
}
export const {paper:paperOutputSchema,revision:revisionOutputSchema}=outputSchemas(curriculum);
