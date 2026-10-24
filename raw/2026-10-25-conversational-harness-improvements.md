# Raw Note - 2026-10-25 - Conversational harness improvements

## Source

Sachit's GTOP local bot conversation: report of repeated topic questions after chapters and all topics were supplied; request to research effective Qwen4B usage; explicit approval, “Okay go ahead, let's make the necessary improvements.” This note paraphrases product intent; private transcripts and runtime artifacts remain outside the repository.

## Context

Administrators should be able to settle a paper's requirements through natural conversation and have that understanding survive follow-ups. The assistant repeatedly asking for narrower topics after an all-topics answer makes the service feel unaccepting and adds work for teachers.

## Key Points

- Treat model size as a capability constraint, not an excuse for forgetting the user's settled requirements. Improve the existing assistant through application evidence.
- Selected chapters plus all topics means all topics within those chapters, not the entire subject syllabus.
- Keep original requests, corrections and established requirements through delegation. Genuine programme, level or source gaps still need precise clarification.
- Discussing a board is different from selecting it. An administrator can pause before creation; a later mention of a board must not silently resume work.
- Report actual execution rather than model-written claims that work has started or completed. Keep friendly conversation concise and local.

## Decisions

Improve the existing conversational harness while retaining the intended local model, controller and specialist roles. Preserve the GTOP core, saved data and stopped legacy question generator. Educational content remains subject to teacher acceptance; technical demonstrations are supporting evidence.
