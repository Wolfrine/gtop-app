const string={type:'string'};
const strings={type:'array',items:string};
export const object=properties=>({type:'object',additionalProperties:false,required:Object.keys(properties),properties});
const alternative=object({question:string,options:strings,correctIndex:{type:['integer','null']},answer:string,markingPoints:strings});
export const questionSchema=object({number:{type:'integer'},chapter:string,type:{type:'string',enum:['mcq','assertion_reason','short_answer','long_answer','numerical','case_based']},marks:{type:'integer'},question:string,options:strings,correctIndex:{type:['integer','null']},answer:string,markingPoints:strings,alternative:{anyOf:[{type:'null'},alternative]}});
export const paperSchema=object({title:string,board:string,standard:string,subject:string,academicYear:string,scope:string,marks:{type:'integer'},durationMinutes:{type:'integer'},questionLanguage:string,answerLanguage:string,instructions:strings,sections:{type:'array',items:object({title:string,instructions:string,questions:{type:'array',items:questionSchema}})},sourceReferences:{type:'array',items:object({id:string,url:string,title:string})}});
export const revisionSchema=object({question:questionSchema,reason:string});
export const reviewSchema=object({verdict:{type:'string',enum:['pass','needs_correction']},summary:string,issues:{type:'array',items:object({questionNumber:{type:'integer'},severity:{type:'string',enum:['minor','major']},problem:string,correction:string})}});
export const proposalSchema=object({reply:string,action:{type:'string',enum:['local_answer','clarify','describe_capabilities','generate_paper','revise_paper','explain_paper','check_curriculum','status','unsupported']},interpretation:string,proposedActions:strings,requirementsPatch:object({board:{type:['string','null']},standard:{type:['string','null']},subject:{type:['string','null']},academicYear:{type:['string','null']},marks:{type:['integer','null']},durationMinutes:{type:['integer','null']},questionLanguage:{type:['string','null']},answerLanguage:{type:['string','null']},sourcePolicy:{type:['string','null']}}),targetQuestionNumber:{type:['integer','null']},memoryPatch:object({assistantLanguage:{type:['string','null']},preferredName:{type:['string','null']}})});
// Only two fields are mandatory for ordinary conversation. Task-only details are
// optional and never grant authority or replace controller-verified requirements.
export const conversationSchema={...object({reply:string,action:proposalSchema.properties.action,interpretation:string,selection:object({chapters:strings,sourceMessageId:string,quote:string})}),required:['reply','action']};

/** Deliberately limited validator for our generated JSON schemas; no coercion. */
export function assertSchema(value,schema,path='output'){
  if(schema.anyOf){if(!schema.anyOf.some(s=>{try{assertSchema(value,s,path);return true;}catch{return false;}}))throw Error(path+' does not match an allowed shape.');return;}
  const types=Array.isArray(schema.type)?schema.type:[schema.type];
  const kind=value===null?'null':Array.isArray(value)?'array':typeof value;
  if(!types.some(t=>t===kind||(t==='integer'&&Number.isInteger(value))||(t==='number'&&typeof value==='number'&&Number.isFinite(value))))throw Error(path+' has an invalid type.');
  if(schema.enum&&!schema.enum.includes(value))throw Error(path+' has an unsupported value.');
  if(kind==='object'){
    for(const key of schema.required??[])if(!(key in value))throw Error(path+'.'+key+' is missing.');
    if(schema.additionalProperties===false&&Object.keys(value).some(k=>!Object.hasOwn(schema.properties,k)))throw Error(path+' has unknown fields.');
    for(const [key,s]of Object.entries(schema.properties??{}))if(key in value)assertSchema(value[key],s,path+'.'+key);
  }
  if(kind==='array'&&schema.items)for(let i=0;i<value.length;i++)assertSchema(value[i],schema.items,path+'['+i+']');
}
