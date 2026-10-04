import functions from 'firebase-functions/v1';
import {publishPaper,uploadPaperAsset,notifyPaperAdmin,paperGateway} from './index.mjs';

// Supported Firestore background triggers use the same validated handlers.
// This route uses existing permissions and does not depend on Eventarc IAM.
const background=(memory,timeoutSeconds)=>functions.region('us-central1').runWith({memory,timeoutSeconds,maxInstances:2,failurePolicy:true,serviceAccount:'78765581239-compute@developer.gserviceaccount.com'}).firestore;
const event=(data,context)=>({data,params:context.params,id:context.eventId,time:context.timestamp});
export const paperChatPublishPaper=background('512MB',300).document('paperDrafts/{paperId}').onWrite((change,context)=>publishPaper.run(event(change,context)));
export const paperChatUploadAsset=background('512MB',300).document('paperAssetUploads/{assetId}').onWrite((change,context)=>uploadPaperAsset.run(event(change,context)));
export const paperChatNotifyAdmin=background('256MB',60).document('paperNotifications/{notificationId}').onCreate((snapshot,context)=>notifyPaperAdmin.run(event(snapshot,context)));
export {paperGateway};
