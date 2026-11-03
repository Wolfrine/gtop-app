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
