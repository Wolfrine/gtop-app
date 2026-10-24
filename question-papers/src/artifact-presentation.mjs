// Trusted view-only presentation for immutable gateway artifacts. Never persist this copy.
import {cleanExamHtml} from '../../assistant-service/domain/exam-copy.mjs';
export const artifactPresentationVersion=3;
const presentationCss=`
@media screen {
  .katex { display:inline-block; box-sizing:border-box; max-width:100%; padding-inline-end:.35em; overflow-x:auto; overflow-y:hidden; vertical-align:middle; }
  .katex-display { max-width:100%; overflow-x:auto; overflow-y:hidden; }
  .katex:focus-visible, .katex-display:focus-visible { outline:2px solid #4278bd; outline-offset:2px; }
}
@media print {
  .katex { display:inline; max-width:none; padding-inline-end:0; overflow:visible; }
  .katex-display { max-width:none; overflow:visible; }
}
`;
/** @param {string} html @param {number|null} revision */
export function presentArtifact(html,revision=null) {
  if(typeof html!=='string')throw new TypeError('Expected trusted artifact HTML');
  // Keep model-written schema/workflow directions out of examination instructions.
  // This is a view of the immutable original, not a rewrite of the stored paper.
  let view=cleanExamHtml(html);
  const style=`<style id="gtop-artifact-presentation" data-presentation-version="${artifactPresentationVersion}">${presentationCss}</style>`;
  // The original string remains the source of truth for storage and its integrity hash.
  return /<\/head\s*>/i.test(view)?view.replace(/<\/head\s*>/i,style+'</head>'):view+style;
}
