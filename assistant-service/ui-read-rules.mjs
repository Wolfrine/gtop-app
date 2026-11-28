import {dispatchRule as legacyDispatchRule} from './dispatch-rule.mjs';

// Exact additive grants. Shared-rule release guards remove only these blocks.
export const uiReadRules=`    match /assistantUiNotifications/{ownerUid} {
      allow get: if request.auth != null && request.auth.uid == ownerUid
        && request.auth.token.get('firebase', {}).get('sign_in_provider', '') != 'anonymous'
        && isAdmin()
        && ownerUid in get(/databases/$(database)/documents/assistantConfig/pilot).data.allowedOwnerUids;
      allow list, write: if false;
    }

    match /assistantWorkerHealth/{workerId} {
      allow get: if signedIn()
        && request.auth.token.get('firebase', {}).get('sign_in_provider', '') != 'anonymous'
        && isAdmin()
        && request.auth.uid in get(/databases/$(database)/documents/assistantConfig/pilot).data.allowedOwnerUids
        && get(/databases/$(database)/documents/assistantWorkers/$(workerId)).data.enabled == true
        && request.auth.uid in get(/databases/$(database)/documents/assistantWorkers/$(workerId)).data.allowedOwnerUids;
      allow list, write: if false;
    }
`;
export const withoutUiReadRules=source=>source.replaceAll('\r\n','\n').replace(uiReadRules,'');

export const submissionInboxRule=`    match /assistantInboxNotifications/submissions {
      allow get: if isAdmin()
        && request.auth.token.get('firebase', {}).get('sign_in_provider', '') != 'anonymous'
        && request.auth.uid in get(/databases/$(database)/documents/assistantConfig/pilot).data.allowedOwnerUids;
      allow list, write: if false;
    }

`;
export const withoutSubmissionInboxRule=source=>source.replaceAll('\r\n','\n').replace(submissionInboxRule,'');

export const examUpdateMarkerRules=`    match /assistantExamUpdateMarkers/staff {
      allow get: if isAdmin()
        && request.auth.token.get('firebase', {}).get('sign_in_provider', '') != 'anonymous'
        && request.auth.uid in get(/databases/$(database)/documents/assistantConfig/pilot).data.allowedOwnerUids;
      allow list, write: if false;
    }

    match /assistantExamUpdateMarkers/staff/owners/{ownerUid} {
      allow get: if isAdmin()
        && request.auth.token.get('firebase', {}).get('sign_in_provider', '') != 'anonymous'
        && request.auth.uid == ownerUid
        && ownerUid in get(/databases/$(database)/documents/assistantConfig/pilot).data.allowedOwnerUids;
      allow list, write: if false;
    }

`;
export const withoutExamUpdateMarkerRules=source=>source.replaceAll('\r\n','\n').replace(examUpdateMarkerRules,'');

export const managedPapersRule = `    function papersManaged() {
      let policy = get(/databases/$(database)/documents/assistantConfig/pilot).data;
      return policy.get('managedAccess', false) == true && policy.get('dispatchVersion', 1) == 2;
    }

    function papersHuman() {
      return signedIn() && request.auth.token.get('firebase', {}).get('sign_in_provider', '') != 'anonymous';
    }

    function papersStaff() {
      return papersHuman() && isAdmin() && (papersManaged()
        || request.auth.uid in get(/databases/$(database)/documents/assistantConfig/pilot).data.allowedOwnerUids);
    }

    function papersOwner() {
      return papersStaff() || (papersHuman() && papersManaged()
        && get(/databases/$(database)/documents/assistantPapersAccess/$(request.auth.uid)).data.status == 'approved'
        && get(/databases/$(database)/documents/assistantPapersAccess/$(request.auth.uid)).data.version is int
        && get(/databases/$(database)/documents/assistantPapersAccess/$(request.auth.uid)).data.version > 0);
    }

    match /assistantExamUpdateMarkers/staff {
      allow get: if papersStaff();
      allow list, write: if false;
    }

    match /assistantExamUpdateMarkers/staff/owners/{ownerUid} {
      allow get: if papersStaff() && request.auth.uid == ownerUid;
      allow list, write: if false;
    }

    match /assistantInboxNotifications/submissions {
      allow get: if papersStaff();
      allow list, write: if false;
    }

    match /assistantUiNotifications/{ownerUid} {
      allow get: if papersHuman() && request.auth.uid == ownerUid && papersOwner();
      allow list, write: if false;
    }

    match /assistantWorkerDispatch/{dispatchId} {
      allow get: if request.auth != null
        && request.auth.token.get('assistantWorker', false) == true
        && request.auth.token.get('workerId', '') == 'sachit-windows'
        && request.auth.uid == 'assistant-worker-sachit-windows'
        && dispatchId in ['sachit-windows-generation', 'sachit-windows-checking']
        && get(/databases/$(database)/documents/assistantWorkers/sachit-windows).data.enabled == true;
      allow list, write: if false;
    }

    match /assistantPapersAccess/{document=**} {
      allow read, write: if false;
    }

    match /assistantWorkerHealth/{workerId} {
      allow get: if signedIn()
        && request.auth.token.get('firebase', {}).get('sign_in_provider', '') != 'anonymous'
        && isAdmin()
        && request.auth.uid in get(/databases/$(database)/documents/assistantConfig/pilot).data.allowedOwnerUids
        && get(/databases/$(database)/documents/assistantWorkers/$(workerId)).data.enabled == true
        && request.auth.uid in get(/databases/$(database)/documents/assistantWorkers/$(workerId)).data.allowedOwnerUids;
      allow list, write: if false;
    }

    match /assistantDispatch/{ownerUid} {
      allow get: if request.auth != null
        && get(/databases/$(database)/documents/assistantConfig/pilot).data.get('dispatchVersion', 1) != 2
        && request.auth.token.get('firebase', {}).get('sign_in_provider', '') != 'anonymous' && (
        (request.auth.uid == ownerUid && isAdmin()
          && ownerUid in get(/databases/$(database)/documents/assistantConfig/pilot).data.allowedOwnerUids)
        || (request.auth.token.get('assistantWorker', false) == true
          && request.auth.uid == 'assistant-worker-' + request.auth.token.workerId
          && get(/databases/$(database)/documents/assistantWorkers/$(request.auth.token.workerId)).data.enabled == true
          && ownerUid in get(/databases/$(database)/documents/assistantWorkers/$(request.auth.token.workerId)).data.allowedOwnerUids)
      );
      allow list, write: if false;
    }

`;
export function legacyPapersRuleSource(source) {
  return source.replaceAll('\r\n','\n').replace(managedPapersRule,
    examUpdateMarkerRules + submissionInboxRule + uiReadRules + '\n' + legacyDispatchRule + '\n');
}
