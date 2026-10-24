import {curriculum,paperSchema,revisionSchema} from '../../../assistant-service/domain/index.mjs';

// The specialist must copy controller-owned identifiers, rather than inventing
// source IDs or combining chapter labels. The gateway still validates results.
const chapter={type:'string',enum:curriculum.chapters.map((c:any)=>c.title)};
export const paperOutputSchema=structuredClone(paperSchema);
paperOutputSchema.properties.sections.items.properties.questions.items.properties.chapter=chapter;
const source=paperOutputSchema.properties.sourceReferences.items.properties;
source.id={type:'string',enum:[curriculum.id]};
source.url={type:'string',enum:[curriculum.url]};
export const revisionOutputSchema=structuredClone(revisionSchema);
revisionOutputSchema.properties.question.properties.chapter=chapter;
