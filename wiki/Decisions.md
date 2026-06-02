# Decisions

## Summary

This page records product and business decisions that should guide future GTOP work. Technical implementation decisions belong in `docs/` or engineering plans unless they materially affect product direction.

## GTOP Is Independent

GTOP is owned as an independent production application. It should not be treated as a Hub submodule.

## Hub Integration Is Contract-Based

Hub integration should remain contract-based through URL parameters and return paths. GTOP should preserve integration values such as `hubSource`, `hubSessionId`, and `hubReturnPath` when work touches quiz launch or summary flows.

## Wiki And Technical Docs Are Separate

The project wiki captures product intent, user problems, product logic, decisions, open questions, and implementation-independent lessons. Existing `docs/` captures technical and functional documentation.

## Quiz Runs Reuse Live Quiz Concepts

Quiz Run is positioned as a lighter peer-to-peer practice mode, reusing the live quiz infrastructure conceptually while avoiding unnecessary admin-host assumptions in the user experience.

## Source Notes

- `raw/2026-06-02-gtop-existing-docs-baseline.md`
