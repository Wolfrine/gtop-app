// Trusted view-only presentation for immutable gateway artifacts. Never persist this copy.
export const artifactPresentationVersion=1;
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
export function presentArtifact(html) {
  if(typeof html!=='string')throw new TypeError('Expected trusted artifact HTML');
  const style=`<style id="gtop-artifact-presentation" data-presentation-version="${artifactPresentationVersion}">${presentationCss}</style>`;
  // The original string remains the source of truth for storage and its integrity hash.
  return /<\/head\s*>/i.test(html)?html.replace(/<\/head\s*>/i,style+'</head>'):html+style;
}
