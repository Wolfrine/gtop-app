import {createInterface} from 'node:readline';
import {randomUUID} from 'node:crypto';
import {readFile, rename, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertSchema, paperSchema} from '../../../assistant-service/domain/schemas.mjs';

const fields = ['board','standard','subject','academicYear','scope','marks','durationMinutes','questionLanguage','answerLanguage'];
const string = {type:'string'};
const standard = {...string, description:'Use the requested class label, for example 12.'};
const paper = {...paperSchema, properties:{...paperSchema.properties, standard}};
const requirements = {
  type:'object', additionalProperties:false, required:[...fields,'sourcePolicy','format','internalChoices'],
  properties:{
    board:string, standard, subject:string, academicYear:string,
    scope:string,
    marks:{type:'integer'}, durationMinutes:{type:'integer'}, questionLanguage:string, answerLanguage:string,
    sourcePolicy:string, format:{...string,description:'Use board or practice when applicable for Paper Library filters.'},
    internalChoices:{type:'boolean',description:'True only for whole-question OR alternatives.'},
    selectedChapters:{type:'array',items:string}, programme:string, level:string, subjectCode:string,
    examYear:string, edition:string, questionStyle:string, markAllocation:string,
  },
};
const schema = {
  type:'object', additionalProperties:false, required:['paper','requirements'],
  properties:{paper, requirements, basePaperId:string, targetQuestionNumber:{type:'integer'}},
};

export function validatePackage(value) {
  if (Buffer.byteLength(JSON.stringify(value ?? null)) > 400_000) throw Error('The paper exceeds the delivery size limit.');
  assertSchema(value,schema,'package');
  return value;
}

const tools = [
  {name:'saved_context',description:'Read the paper or older messages already saved to this same conversation, when needed for a revision or to recover prior context.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
  {name:'stage_paper',description:'Stage the entire authored student paper and worked answers for private delivery after this turn. Submit one whole package for technical rendering. Use the format requested by the teacher and cite sources accurately.',inputSchema:schema},
];

async function serve(directory) {
  const lines = createInterface({input:process.stdin,crlfDelay:Infinity});
  const reply = (id, result) => process.stdout.write(JSON.stringify({jsonrpc:'2.0',id,...result})+'\n');
  for await (const line of lines) {
    let msg;
    try { msg=JSON.parse(line); } catch { continue; }
    if (msg.id === undefined) continue;
    try {
      let result;
      switch (msg.method) {
        case 'initialize':
          result={protocolVersion:msg.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'gt_papers',version:'1.0.0'}};
          break;
        case 'ping': result={}; break;
        case 'tools/list': result={tools}; break;
        case 'tools/call': {
          let text;
          if (msg.params.name === 'saved_context') {
            text=await readFile(path.join(directory,'context.json'),'utf8');
          } else if (msg.params.name === 'stage_paper') {
            const value=validatePackage(msg.params.arguments);
            const pending=path.join(directory,'package-'+randomUUID()+'.tmp');
            await writeFile(pending,JSON.stringify(value),{flag:'wx'});
            await rename(pending,path.join(directory,'package.json'));
            text='The package is staged for validation and delivery after the native turn completes.';
          } else {
            throw Error('Tool unavailable.');
          }
          result={content:[{type:'text',text}]};
          break;
        }
        default: reply(msg.id,{error:{code:-32601,message:'Method unavailable.'}}); continue;
      }
      reply(msg.id,{result});
    } catch(error) {
      const text=error.code?'The saved context or paper staging is unavailable.':error.message;
      reply(msg.id,{result:{isError:true,content:[{type:'text',text}]}});
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await serve(path.resolve(process.argv[2]));
}
