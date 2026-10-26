import {HttpError} from './service.mjs';
const allowedOrigins=new Set(['https://gtop-question-papers.web.app','https://gtop-question-papers.firebaseapp.com','https://pti-app-2ab59.web.app','https://pti-app-2ab59.firebaseapp.com','http://localhost:4317','http://127.0.0.1:4317']);
/** Pure HTTP boundary: authentication is injected, so checks can be exercised without cloud credentials. */
export function createGateway(service,verifyIdToken,{allowLocalOrigins=false,verifyHostIdToken=null}={}) {
  return async ({method,path,headers={},body={}})=>{
    const responseHeaders={'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Content-Type':'application/json; charset=utf-8'};
    const origin=headers.origin || headers.Origin;
    if(origin && allowedOrigins.has(origin) && (allowLocalOrigins || !origin.startsWith('http://'))) {responseHeaders['Access-Control-Allow-Origin']=origin;responseHeaders.Vary='Origin';responseHeaders['Access-Control-Allow-Headers']='Authorization, Content-Type';responseHeaders['Access-Control-Allow-Methods']='GET, POST, OPTIONS';}
    try {
      if(origin && !responseHeaders['Access-Control-Allow-Origin'])throw new HttpError(403,'origin_denied','Origin is not allowed.');
      if(method==='OPTIONS')return {status:204,headers:responseHeaders,body:null};
      if(!['GET','POST'].includes(method))throw new HttpError(405,'method_not_allowed','Method is not supported.');
      if(!body || typeof body!=='object' || Array.isArray(body))throw new HttpError(400,'invalid_body','A JSON object is required.');
      if(Buffer.byteLength(JSON.stringify(body || {}))>600000)throw new HttpError(413,'payload_too_large','Request is too large.');
      path=path.split('?')[0].replace(/^\/api(?=\/|$)/,'').replace(/\/$/,'') || '/';
      if(method==='POST' && path==='/worker/session')return {status:200,headers:responseHeaders,body:await service.bootstrap(body)};
      const bearer=(headers.authorization || headers.Authorization || '').match(/^Bearer (\S+)$/);
      if(!bearer)throw new HttpError(401,'sign_in_required','Authentication is required.');
      if(path.startsWith('/host/')){
        let claims;try{if(!verifyHostIdToken)throw Error('Unavailable');claims=await verifyHostIdToken(bearer[1]);}catch{throw new HttpError(401,'invalid_token','Sign in to PTI again to continue.');}
        const user=service.serviceControl.ptiUser(claims);let output;
        if(method==='GET'&&path==='/host/status')output={service:await service.serviceControl.get(user)};
        else if(method==='POST'&&path==='/host/start')output=await service.serviceControl.start(user,body);
        else throw new HttpError(404,'not_found','Endpoint unavailable.');
        return {status:200,headers:responseHeaders,body:output};
      }
      let claims;try{claims=await verifyIdToken(bearer[1]);}catch{throw new HttpError(401,'invalid_token','Sign in again to continue.');}
      let output;
      if(path.startsWith('/worker/')) {
        const worker=await service.worker(claims);
        if(method==='POST' && path==='/worker/heartbeat')output=await service.heartbeat(worker,body);
        else if(method==='POST' && path==='/worker/service/poll')output=await service.serviceControl.poll(worker,body);
        else if(method==='POST' && path==='/worker/curriculum/catalogue')output=await service.curriculumCatalogue();
        else if(method==='POST' && path==='/worker/curriculum/resolve')output={curriculum:await service.resolveCurriculum(body.requirements,body.conversationId,worker)};
        else if(method==='POST' && path==='/worker/claim')output=await service.claim(worker,body);
        else {const m=path.match(/^\/worker\/jobs\/([^/]+)\/(heartbeat|event|delegate|complete|fail)$/);if(method!=='POST'||!m)throw new HttpError(404,'not_found','Endpoint unavailable.');const fn={heartbeat:'renew',event:'event',delegate:'delegate',complete:'complete',fail:'failed'}[m[2]];output=await service[fn](worker,m[1],body);}
      } else {
        const user=await service.user(claims),uid=user.uid;
        if(method==='GET' && path==='/session')output=await service.session(user);
        else if(method==='POST' && path==='/service/start')output=await service.serviceControl.start(user,body);
        else if(method==='GET' && path==='/conversations')output=await service.conversations(uid);
        else if(method==='POST' && path==='/conversations')output=await service.createConversation(uid,body);
        else if(method==='POST' && path==='/feedback')output=await service.feedback(uid,body);
        else if(method==='POST' && path==='/admin/library')output=await service.adminLibrary(uid,body);
        else if(method==='GET' && /^\/admin\/conversations\/[^/]+$/.test(path))output=await service.adminConversation(uid,path.split('/').at(-1));
        else {let m;
          if(method==='GET' && (m=path.match(/^\/conversations\/([^/]+)$/)))output=await service.conversation(uid,m[1]);
          else if(method==='POST' && (m=path.match(/^\/conversations\/([^/]+)\/messages$/)))output=await service.submit(uid,m[1],body);
          else if(method==='POST' && (m=path.match(/^\/jobs\/([^/]+)\/(cancel|retry)$/)))output=await service[m[2]](uid,m[1]);
          else if(method==='GET' && (m=path.match(/^\/papers\/([^/]+)$/)))output=await service.paper(uid,m[1]);
          else if(method==='GET' && (m=path.match(/^\/(admin\/)?papers\/([^/]+)\/artifact\/(student|answers)$/))){output=await service[m[1]?'adminArtifact':'artifact'](uid,m[2],m[3]);responseHeaders['Content-Type']='text/html; charset=utf-8';responseHeaders['Content-Security-Policy']="default-src 'none'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";}
          else throw new HttpError(404,'not_found','Endpoint unavailable.');
        }
      }
      return {status:200,headers:responseHeaders,body:output};
    }catch(error){if(!(error instanceof HttpError))console.error('Assistant gateway error:',error.code || error.name,error.message);return {status:error.status || 500,headers:responseHeaders,body:{error:{code:error.code || 'internal_error',message:error.status?error.message:'The assistant service could not complete this request.'}}};}
  };
}
