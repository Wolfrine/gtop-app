import {Firestore} from 'firebase-admin/firestore';
import {GoogleAuth,Impersonated} from 'google-auth-library';

export function createDelegatedFirestore(projectId,sourceClient){
  const authClient=new Impersonated({sourceClient,
    targetPrincipal:'78765581239-compute@developer.gserviceaccount.com',
    targetScopes:['https://www.googleapis.com/auth/datastore'],lifetime:1200});
  const getRequestHeaders=authClient.getRequestHeaders.bind(authClient);
  // google-auth-library 10 returns Fetch Headers. The installed grpc-js
  // credential adapter consumes enumerable record keys, so pass a record at
  // this boundary. Keep the real impersonation client and its refresh logic.
  authClient.getRequestHeaders=async(...args)=>{
    const headers=await getRequestHeaders(...args);
    return typeof headers.entries==='function'?Object.fromEntries(headers.entries()):headers;
  };
  return new Firestore({projectId,auth:new GoogleAuth({projectId,authClient})});
}
