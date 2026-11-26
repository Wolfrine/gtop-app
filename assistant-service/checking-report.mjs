import * as pdfLib from 'pdf-lib';
import {checkedPdfCanvas} from './checked-pdf-canvas.mjs';
import {renderCheckedReturn} from './domain/checked-return-pdf.mjs';

export const checkingReportLayout='checked-return-a4-v1';

export async function checkingReport(title,outcome,grade,message,images=[],identity={}){
  const {id,label,studentUid,studentLabel,labelFromStudent,singleStudentBook,packetLabel,pageCount,uploaded=[]}=identity;
  const detail={rubric:{title,marks:grade?.max??null},sheet:{id,label,studentUid,studentLabel,labelFromStudent,
    singleStudentBook,packetLabel,pageCount,grade,uploaded}};
  const canvas=await checkedPdfCanvas();
  const pdf=await renderCheckedReturn({
    pdfLib,detail,pages:images,outcome,message,...canvas,
    assessedAwarded:grade?.assessedMax>0?grade.awarded:null,assessedMax:grade?.assessedMax??null,
  });
  return Buffer.from(pdf);
}
