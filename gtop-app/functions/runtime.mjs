import functions from 'firebase-functions/v1';
import {GoogleAuth} from 'google-auth-library';
import {publishPaper,uploadPaperAsset,notifyPaperAdmin,paperGateway,registerConversation,registerRequest,registerPaper,registerMessage} from './index.mjs';

// Gen1's Firebase adapter reads this project value before invoking its handler.
// gcloud deployments omit it and the API forbids setting it as deployment env.
// Resolve it before calling the complete SDK wrapper. Keep module loading
// synchronous for Firebase discovery/require(ESM), and preserve its descriptors.
let projectReady;
function withRuntimeProject(handler){
  const initialized=async(...args)=>{
    if(!process.env.GCLOUD_PROJECT){
      projectReady??=new GoogleAuth().getProjectId().then(project=>{process.env.GCLOUD_PROJECT||=project;}).catch(error=>{projectReady=undefined;throw error;});
      await projectReady;
    }
    return handler(...args);
  };
  return Object.defineProperties(initialized,Object.getOwnPropertyDescriptors(handler));
}

// Supported Firestore background triggers use the same validated handlers.
// This route uses existing permissions and does not depend on Eventarc IAM.
const background=(memory,timeoutSeconds)=>functions.region('us-central1').runWith({memory,timeoutSeconds,maxInstances:2,failurePolicy:true,serviceAccount:'78765581239-compute@developer.gserviceaccount.com'}).firestore;
const event=(data,context)=>({data,params:context.params,id:context.eventId,time:context.timestamp});
export const paperChatPublishPaper=withRuntimeProject(background('512MB',300).document('paperDrafts/{paperId}').onWrite((change,context)=>publishPaper.run(event(change,context))));
export const paperChatUploadAsset=withRuntimeProject(background('512MB',300).document('paperAssetUploads/{assetId}').onWrite((change,context)=>uploadPaperAsset.run(event(change,context))));
export const paperChatNotifyAdmin=withRuntimeProject(background('256MB',60).document('paperNotifications/{notificationId}').onCreate((snapshot,context)=>notifyPaperAdmin.run(event(snapshot,context))));
export const paperRegisterConversation=withRuntimeProject(background('256MB',120).document('paperConversations/{id}').onWrite((change,context)=>registerConversation.run(event(change,context))));
export const paperRegisterRequest=withRuntimeProject(background('256MB',120).document('paperRequests/{id}').onWrite((change,context)=>registerRequest.run(event(change,context))));
export const paperRegisterPaper=withRuntimeProject(background('256MB',120).document('paperDrafts/{id}').onWrite((change,context)=>registerPaper.run(event(change,context))));
export const paperRegisterMessage=withRuntimeProject(background('256MB',120).document('paperMessages/{id}').onWrite((change,context)=>registerMessage.run(event(change,context))));
export {paperGateway};
