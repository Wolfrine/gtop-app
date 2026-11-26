import {createHash} from 'node:crypto';

const fingerprintPattern=/^[a-f0-9]{64}$/;
export const verifiedQuestionWordingSha=wording=>createHash('sha256').update(wording,'utf8').digest('hex');

export const verifiedQuestionSourcePath=(uid,fingerprint)=>
  'assistantCheckingOwners/'+uid+'/verifiedQuestionSources/'+fingerprint;

const printedLabel=value=>String(value??'').normalize('NFKC').trim()
  .replace(/^(?:question\s*|q\.?\s*)/i,'').replace(/[.)\s]+$/g,'').toLowerCase();

export function corroborateSourceReference(reference,{sourceFingerprint,sourceEvidence}){
  if(!sourceEvidence)return {reference};
  if(!fingerprintPattern.test(sourceFingerprint)||sourceEvidence.fingerprint!==sourceFingerprint||
      typeof sourceEvidence.sourceReferenceId!=='string'||!Array.isArray(sourceEvidence.questions)||
      !sourceEvidence.questions.length||sourceEvidence.questions.length>20)
    throw Error('The question source evidence does not match this upload.');
  if(!Array.isArray(reference?.sections)||!Array.isArray(reference.issues))return {reference};

  const draft=structuredClone(reference);
  const candidates=draft.sections.flatMap(section=>Array.isArray(section?.questions)?section.questions:[]);
  const checks=[];
  for(const observed of sourceEvidence.questions){
    const {number,label,sourcePage,marks,question,reason,wordingSha}=observed;
    if(!Number.isSafeInteger(number)||number<1||!Number.isSafeInteger(sourcePage)||sourcePage<1||
        !Number.isFinite(marks)||marks<=0||typeof question!=='string'||!question.trim()||
        verifiedQuestionWordingSha(question)!==wordingSha||typeof reason!=='string'||!reason.trim()||reason.length>400)
      throw Error('The recorded question source evidence is incomplete.');
    const matched=candidates.filter(item=>item?.number===number&&item.sourcePage===sourcePage&&
      item.marks===marks&&printedLabel(item.label)===printedLabel(label)&&item.alternative===null);
    if(matched.length!==1){
      draft.issues.push('Verified source wording could not be matched to a unique extracted question on page '+sourcePage+'.');
      continue;
    }
    const [item]=matched;
    checks.push({number,sourcePage,corrected:item.question!==question});
    // The original upload fingerprint binds this observed text to the same physical pages.
    // Keep the fresh reference for every other item and disclose the uncertainty on this one.
    item.question=question;
    item.sourceIssue=reason;
  }
  return {reference:draft,sourceFidelity:{verifiedReferenceId:sourceEvidence.sourceReferenceId,checks}};
}
