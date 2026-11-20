import {region} from 'firebase-functions/v1';
import {getFirestore} from 'firebase-admin/firestore';
import {FirestoreStore} from './store.mjs';
import {studentName, syncStudentIndex} from './student-index.mjs';

const trigger = region('us-central1')
  .runWith({memory: '256MB', timeoutSeconds: 60, maxInstances: 2, failurePolicy: true})
  .firestore.document('users/{uid}').onWrite(async (change, context) => {
    if (studentName(change.before.data()) !== studentName(change.after.data())) {
      await syncStudentIndex(new FirestoreStore(getFirestore()), context.params.uid);
    }
  });

// The Gen1 adapter needs the project before it decodes the Firestore event.
// gcloud does not supply GCLOUD_PROJECT on this project's Gen1 deployment.
function handle(event, context) {
  process.env.GCLOUD_PROJECT ||= process.env.GOOGLE_CLOUD_PROJECT || 'gtop-app';
  return trigger(event, context);
}
export const gtopAssistantIndexStudent = Object.defineProperties(handle, Object.getOwnPropertyDescriptors(trigger));
