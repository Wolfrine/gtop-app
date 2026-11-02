// Exact reviewed grant; release guards remove only these bytes when comparing
// against the previous shared policy. No collection queries or payload access.
export const dispatchRule = `    match /assistantDispatch/{ownerUid} {
      allow get: if request.auth != null
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
export const withoutDispatchRule = source => source.replaceAll('\r\n','\n').replace(dispatchRule, '');
