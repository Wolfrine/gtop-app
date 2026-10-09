#!/usr/bin/env python3
"""Build review-only baseline catalog, route coverage, and screenshot gallery.

Reads capture manifests and route inventory without modifying either. All generated
records remain pending visual review unless inspection metadata is provided;
audit-ineligible diagnostics stay in provenance but are excluded from selections.
"""
from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from typing import Any


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def route_url(value: str | None) -> tuple[str, dict[str, list[str]]]:
    if not value:
        return "", {}
    parts = urlsplit(value)
    query = parse_qs(parts.query, keep_blank_values=True)
    for key in ("emulator", "testEmail", "testPassword"):
        query.pop(key, None)
    return parts.path or "/", query


def normalized_url(value: str | None) -> str:
    path, query = route_url(value)
    pairs = [(k, v) for k, vals in query.items() for v in vals]
    suffix = "&".join(f"{k}={v}" for k, v in sorted(pairs))
    return path + ("?" + suffix if suffix else "")


def is_redirect(requested: str | None, actual: str | None) -> bool:
    if not requested or not actual:
        return False
    return route_url(requested)[0] != route_url(actual)[0]


def query_changed(requested: str | None, actual: str | None) -> bool:
    return bool(requested and actual and route_url(requested)[1] != route_url(actual)[1])


def viewport_name(entry: dict[str, Any]) -> str:
    width = (entry.get("viewport") or {}).get("width")
    if isinstance(width, (int, float)) and width <= 600:
        return "mobile"
    return "desktop"


def route_pattern_matches(pattern: str, path: str) -> bool:
    # Angular route parameters occupy exactly one path segment.
    pattern_parts = (pattern.strip("/").split("/") if pattern.strip("/") else [])
    path_parts = (path.strip("/").split("/") if path.strip("/") else [])
    if len(pattern_parts) != len(path_parts):
        return False
    return all(expected.startswith(":") or expected == actual for expected, actual in zip(pattern_parts, path_parts))


def route_matches(route: dict[str, Any], evidence_route: str) -> bool:
    path, query = route_url(evidence_route)
    route_path = route.get("path", "")
    if not route_pattern_matches(route_path, path):
        return False
    # The ordered /quiz route entries use canMatch to select invited or ordinary
    # practice. The invitation surface is selected by practice=invite.
    if route_path == "/quiz":
        invited = query.get("practice", [""])[0] == "invite"
        label = (route.get("variant") or "").lower()
        wants_invited = "invited" in label or "invite" in label
        if wants_invited != invited:
            return False
    return True


def record_from_entry(run_id: str, manifest_path: Path, entry: dict[str, Any], workspace_root: Path) -> dict[str, Any]:
    requested = entry.get("requestedRoute")
    actual = entry.get("route")
    redirected = is_redirect(requested, actual)
    changed_query = query_changed(requested, actual)
    image = entry.get("image") or {}
    screen_state = entry.get("screenState") or entry.get("state") or entry.get("id")
    return {
        "recordId": f"{run_id}:{entry.get('id', screen_state)}",
        "runId": run_id,
        "sourceManifest": manifest_path.relative_to(workspace_root).as_posix() if manifest_path.is_relative_to(workspace_root) else manifest_path.as_posix(),
        "sourceCommit": entry.get("sourceCommit"),
        "capturedAt": entry.get("capturedAt"),
        "environment": entry.get("environment", "isolated-emulator"),
        "synthetic": entry.get("synthetic", True),
        "role": entry.get("role"),
        "stateKey": str(screen_state),
        "state": entry.get("state"),
        "route": actual,
        "requestedRoute": requested,
        "redirect": redirected,
        "queryChanged": changed_query,
        "requestedQuery": route_url(requested)[1] if requested else {},
        "actualQuery": route_url(actual)[1] if actual else {},
        "redirectLabel": (
            f"Path changed: requested {route_url(requested)[0]}; landed at {route_url(actual)[0]}"
            if redirected else None
        ),
        "viewport": entry.get("viewport"),
        "viewportClass": viewport_name(entry),
        "imagePath": image.get("path"),
        "imageSha256": image.get("sha256"),
        "imageWidth": image.get("width"),
        "imageHeight": image.get("height"),
        "fullPage": entry.get("fullPage"),
        "runtimeErrorCount": len(entry.get("runtimeErrors", []) or []),
        "auditEligible": entry.get("auditEligible", True) is not False,
        "visualStatus": "pending_visual",
    }


def latest_records(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    latest: dict[tuple[str, str], dict[str, Any]] = {}
    for record in records:
        if not record.get("auditEligible", True):
            continue
        key = (record["stateKey"], record["viewportClass"])
        incumbent = latest.get(key)
        stamp = record.get("capturedAt") or ""
        old_stamp = incumbent.get("capturedAt") or "" if incumbent else ""
        if incumbent is None or (stamp, record["runId"], record["recordId"]) > (old_stamp, incumbent["runId"], incumbent["recordId"]):
            latest[key] = record
    return sorted(latest.values(), key=lambda item: (item["stateKey"], item["viewportClass"]))


def markdown_link(record: dict[str, Any], gallery_dir: Path, workspace_root: Path) -> str:
    image_path = record.get("imagePath")
    if not image_path:
        return "—"
    image_target = workspace_root / "design-upgrade" / image_path
    target = Path(os.path.relpath(image_target, start=gallery_dir)).as_posix()
    return f"[open screenshot]({target})"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    script_dir = Path(__file__).resolve().parent
    inferred_root = script_dir.parent if script_dir.name in {"step2", "design-upgrade"} else script_dir
    parser.add_argument("--workspace-root", type=Path, help="Repository root; relative input paths resolve from here")
    parser.add_argument("--evidence-root", type=Path, help="Baseline evidence directory containing per-run subdirectories")
    parser.add_argument("--routes-file", type=Path, help="Route inventory JSON")
    parser.add_argument("--output-dir", type=Path, help="Generated review artifacts directory")
    parser.add_argument("--inspection-file", type=Path, help="Optional JSON overrides keyed by recordId")
    args = parser.parse_args()

    root = (args.workspace_root or inferred_root).resolve()
    def rooted(path: Path | None, default: Path) -> Path:
        candidate = path if path is not None else default
        return (candidate if candidate.is_absolute() else root / candidate).resolve()

    evidence_root = rooted(args.evidence_root, Path("design-upgrade/evidence/baseline/2026-10-09"))
    routes_file = rooted(args.routes_file, Path("design-upgrade/sitemap/routes.json") if script_dir.name == "design-upgrade" else Path("step2/routes.json"))
    canonical_layout = args.output_dir is None and script_dir.name == "design-upgrade"
    output_dir = rooted(args.output_dir, Path("design-upgrade") if canonical_layout else Path("step2/generated"))
    output_dir.mkdir(parents=True, exist_ok=True)
    sitemap_dir = output_dir / "sitemap"
    sitemap_dir.mkdir(parents=True, exist_ok=True)
    catalog_path = output_dir / "screens/baseline-catalog.json" if canonical_layout else output_dir / "baseline-catalog.json"
    catalog_path.parent.mkdir(parents=True, exist_ok=True)
    gallery_dir = sitemap_dir.resolve()

    route_doc = load_json(routes_file)
    source_routes = route_doc.get("routes", [])
    manifests = sorted(evidence_root.glob("*/manifest.json"))
    all_records: list[dict[str, Any]] = []
    excluded: list[dict[str, Any]] = []
    live_public: list[dict[str, Any]] = []
    manifest_sources: list[dict[str, Any]] = []

    for manifest_path in manifests:
        manifest = load_json(manifest_path)
        run_id = manifest_path.parent.name
        manifest_sources.append({
            "runId": run_id,
            "manifestPath": manifest_path.relative_to(root).as_posix() if manifest_path.is_relative_to(root) else manifest_path.as_posix(),
            "capturedOn": manifest.get("capturedOn"),
            "sourceCommit": manifest.get("sourceCommit"),
            "entryCount": len(manifest.get("entries", [])),
            "failureCount": len(manifest.get("failures", [])),
        })
        for entry in manifest.get("entries", []):
            record = record_from_entry(run_id, manifest_path, entry, root)
            if entry.get("auditEligible", True) is False:
                record["auditEligible"] = False
                record["excludedFromSelection"] = True
                all_records.append(record)
                excluded.append({
                    "runId": run_id,
                    "id": entry.get("id"),
                    "screenState": entry.get("screenState"),
                    "route": entry.get("route"),
                    "requestedRoute": entry.get("requestedRoute"),
                    "viewport": entry.get("viewport"),
                    "reason": entry.get("auditExclusionReason") or "auditEligible=false",
                })
                continue
            all_records.append(record)
    inspection_source = None
    inspection_overrides: dict[str, Any] = {}
    if args.inspection_file:
        inspection_path = rooted(args.inspection_file, Path(""))
        inspection_source = inspection_path.relative_to(root).as_posix() if inspection_path.is_relative_to(root) else inspection_path.as_posix()
        raw_overrides = load_json(inspection_path)
        inspection_overrides = raw_overrides.get("records", raw_overrides) if isinstance(raw_overrides, dict) else {}
        for record in all_records:
            override = inspection_overrides.get(record["recordId"])
            if not isinstance(override, dict):
                continue
            if isinstance(override.get("visualStatus"), str):
                record["visualStatus"] = override["visualStatus"]
            if isinstance(override.get("auditEligible"), bool):
                record["auditEligible"] = override["auditEligible"]
                if record["auditEligible"]:
                    record.pop("excludedFromSelection", None)
                else:
                    record["excludedFromSelection"] = True
            if isinstance(override.get("notes"), str):
                record["notes"] = override["notes"]
            if isinstance(override.get("observedStateKey"), str):
                record["reportedStateKey"] = record["stateKey"]
                record["stateKey"] = override["observedStateKey"]
            if isinstance(override.get("observedState"), str):
                record["reportedState"] = record["state"]
                record["state"] = override["observedState"]
    for live_path in sorted(evidence_root.glob("*/live-public.json")):
        run_id = live_path.parent.name
        for entry in load_json(live_path):
            image = entry.get("image") or {}
            live_public.append({
                "recordId": f"{run_id}:{entry.get('id', 'live-public')}",
                "runId": run_id,
                "sourceFile": live_path.relative_to(root).as_posix() if live_path.is_relative_to(root) else live_path.as_posix(),
                "id": entry.get("id"),
                "url": entry.get("url"),
                "environment": "live-public",
                "synthetic": False,
                "release": entry.get("release"),
                "capturedAt": entry.get("capturedAt"),
                "viewport": entry.get("viewport"),
                "viewportClass": viewport_name(entry),
                "imagePath": image.get("path"),
                "imageSha256": image.get("sha256"),
                "visualStatus": "pending_visual",
            })
    for record in live_public:
        override = inspection_overrides.get(record["recordId"])
        if isinstance(override, dict):
            if isinstance(override.get("visualStatus"), str):
                record["visualStatus"] = override["visualStatus"]
            if isinstance(override.get("notes"), str):
                record["notes"] = override["notes"]

    latest = latest_records(all_records)
    audit_exclusions = [
        {"recordId": record["recordId"], "stateKey": record["stateKey"],
         "imagePath": record["imagePath"], "reason": record.get("notes") or "Capture diagnostic; see raw manifest"}
        for record in all_records if not record.get("auditEligible", True)
    ]
    latest_map = {f"{record['stateKey']}|{record['viewportClass']}": record["recordId"] for record in latest}
    record_by_id = {record["recordId"]: record for record in all_records}

    coverage_rows = []
    for route in source_routes:
        route_records = []
        entrypoint_mismatches = []
        for record in latest:
            if route_matches(route, record.get("route") or ""):
                route_records.append(record)
            elif record.get("requestedRoute") and route_matches(route, record["requestedRoute"]):
                # Keep the attempted entry point visible for guard/fallback
                # review, but do not use it as evidence that this route rendered.
                entrypoint_mismatches.append({
                    "recordId": record["recordId"],
                    "stateKey": record["stateKey"],
                    "viewportClass": record["viewportClass"],
                    "requestedRoute": record["requestedRoute"],
                    "actualRoute": record["route"],
                    "redirect": record["redirect"],
                    "queryChanged": record["queryChanged"],
                    "imagePath": record["imagePath"],
                    "status": "entrypoint_mismatch_not_counted_as_route_evidence",
                })
        by_state: dict[str, dict[str, Any]] = {}
        for record in route_records:
            by_state.setdefault(record["stateKey"], {})[record["viewportClass"]] = record
        states = []
        for state_key in sorted(by_state):
            viewports = by_state[state_key]
            states.append({
                "stateKey": state_key,
                "desktop": ({"recordId": viewports["desktop"]["recordId"], "imagePath": viewports["desktop"]["imagePath"], "redirect": viewports["desktop"]["redirect"], "queryChanged": viewports["desktop"]["queryChanged"], "redirectLabel": viewports["desktop"]["redirectLabel"]} if "desktop" in viewports else None),
                "mobile": ({"recordId": viewports["mobile"]["recordId"], "imagePath": viewports["mobile"]["imagePath"], "redirect": viewports["mobile"]["redirect"], "queryChanged": viewports["mobile"]["queryChanged"], "redirectLabel": viewports["mobile"]["redirectLabel"]} if "mobile" in viewports else None),
            })
        has_desktop = any("desktop" in x for x in by_state.values())
        has_mobile = any("mobile" in x for x in by_state.values())
        if has_desktop and has_mobile:
            status = "screens_reviewed_with_notes" if all(r["visualStatus"].startswith("reviewed") for r in route_records) else "evidence_present_pending_visual"
        elif has_desktop or has_mobile:
            status = "partial_evidence_pending_visual"
        else:
            status = "no_eligible_evidence"

        path = route.get("path", "")
        row = {
            "id": route.get("id"),
            "path": path,
            "variant": route.get("variant", "default"),
            "capturePath": path,
            "componentFromInventory": route.get("component"),
            "roles": route.get("roles", []),
            "guards": route.get("guards", []),
            "source": route.get("source"),
            "coverageStatus": status,
            "evidenceStates": states,
            "entrypointMismatches": entrypoint_mismatches,
            "desktopEvidencePaths": sorted({s["desktop"]["imagePath"] for s in states if s.get("desktop")}),
            "mobileEvidencePaths": sorted({s["mobile"]["imagePath"] for s in states if s.get("mobile")}),
        }
        if route.get("id") == "R02":
            row["capturePath"] = "/quiz?practice=invite"
            row["variant"] = "invited practice selected by query parameter practice=invite"
            row["routeMatchSemantics"] = "Ordered /quiz route with canMatch=invitedQuizMatch; query parameter practice=invite selects InvitedQuizComponent."
        coverage_rows.append(row)

    coverage = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": {"routesFile": routes_file.relative_to(root).as_posix() if routes_file.is_relative_to(root) else routes_file.as_posix(), "routeEntryCount": route_doc.get("routeEntryCount"), "distinctPathCount": route_doc.get("distinctPathCount")},
        "status": "reviewed_with_notes" if latest and all(r["visualStatus"].startswith("reviewed") for r in latest) else "pending_visual_review",
        "inspectionFile": inspection_source,
        "routeRowCount": len(coverage_rows),
        "distinctSourcePaths": len({route.get("path") for route in source_routes}),
        "routes": coverage_rows,
        "livePublicEvidence": [{"id": x["id"], "url": x["url"], "viewportClass": x["viewportClass"], "imagePath": x["imagePath"], "runId": x["runId"], "visualStatus": x["visualStatus"]} for x in live_public],
        "diagnosticExclusions": excluded,
        "auditExclusions": audit_exclusions,
        "manifestSources": manifest_sources,
    }

    catalog = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "purpose": "Baseline evidence references. Review scope and exceptions are recorded separately; this is not design approval or an exhaustive interaction test.",
        "status": "reviewed_with_notes" if latest and all(r["visualStatus"].startswith("reviewed") for r in latest) else "pending_visual_review",
        "inspectionFile": inspection_source,
        "sourceCommit": route_doc.get("sourceCommit"),
        "routeCounts": {"routeEntries": route_doc.get("routeEntryCount"), "distinctPaths": route_doc.get("distinctPathCount")},
        "manifestSources": manifest_sources,
        "recordCount": len(all_records),
        "eligibleRecordCount": sum(1 for record in all_records if record.get("auditEligible", True)),
        "auditIneligibleRecordCount": sum(1 for record in all_records if not record.get("auditEligible", True)),
        "latestStateViewportCount": len(latest),
        "latestByStateViewport": latest_map,
        "records": all_records,
        "diagnosticExclusions": excluded,
        "auditExclusions": audit_exclusions,
        "livePublic": live_public,
    }
    selected_ids = {record["recordId"] for record in latest}
    for record in all_records:
        record["selectedForAudit"] = record["recordId"] in selected_ids

    gallery_lines = [
        "# Baseline screenshot gallery",
        "",
        "Desktop/mobile pairs from the existing application. [Method and limits](../evidence/baseline/README.md) · [Inspection record](../evidence/baseline/inspection.json) · [Coverage](coverage.json). Synthetic emulator captures and live-public screenshots are shown separately.",
        "",
        f"Emulator capture records: {len(all_records)}; eligible for selection: {sum(1 for record in all_records if record.get('auditEligible', True))}; excluded after capture/review: {len(audit_exclusions)} across {len(manifest_sources)} runs. Live-public records are additional.",
        "",
    ]
    for route_row in coverage_rows:
        gallery_lines += [f"## {route_row['id']} · `{route_row['capturePath']}`", "", f"Variant: {route_row['variant']} · Coverage: `{route_row['coverageStatus']}`", ""]
        if route_row.get("routeMatchSemantics"):
            gallery_lines += [f"> Route selection: {route_row['routeMatchSemantics']}", ""]
        if route_row["evidenceStates"]:
            gallery_lines += ["| State | Desktop | Mobile | Review status |", "|---|---|---|---|"]
            for state in route_row["evidenceStates"]:
                desktop = record_by_id.get(state.get("desktop", {}).get("recordId", "")) if state.get("desktop") else None
                mobile = record_by_id.get(state.get("mobile", {}).get("recordId", "")) if state.get("mobile") else None
                def cell(record: dict[str, Any] | None) -> str:
                    if not record:
                        return "—"
                    label = record.get("visualStatus", "pending_visual")
                    return markdown_link(record, gallery_dir, root) + (" · pathname changed" if record.get("redirect") else "") + f" (`{label}`)"
                review_status = "; ".join(
                    f"{label}: {record['visualStatus']}" for label, record in (("desktop", desktop), ("mobile", mobile)) if record
                )
                gallery_lines.append(f"| `{state['stateKey']}` | {cell(desktop)} | {cell(mobile)} | {review_status or 'pending_visual'} |")
            gallery_lines.append("")
        else:
            gallery_lines += ["No audit-eligible actual-path evidence found.", ""]
        if route_row["entrypointMismatches"]:
            gallery_lines += ["Entry-point mismatches (listed for review; not counted as route evidence):", ""]
            for mismatch in route_row["entrypointMismatches"]:
                record = record_by_id[mismatch["recordId"]]
                gallery_lines.append(
                    f"- `{mismatch['stateKey']}` ({mismatch['viewportClass']}): requested `{normalized_url(mismatch['requestedRoute'])}`, landed at `{normalized_url(mismatch['actualRoute'])}`; {markdown_link(record, gallery_dir, root)}"
                )
            gallery_lines.append("")
    gallery_lines += ["## Live public evidence", "", "Live-public pages are kept separate from synthetic emulator captures.", "", "| ID | Viewport | Screenshot | Captured |", "|---|---|---|---|"]
    for record in live_public:
        gallery_lines.append(f"| `{record['id']}` | {record['viewportClass']} | {markdown_link(record, gallery_dir, root)} | {record.get('capturedAt', '')} |")
    gallery_lines += ["", "Visual-review status comes only from the optional inspection metadata; no automatic review declaration is made.", ""]

    catalog_path.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (sitemap_dir / "coverage.json").write_text(json.dumps(coverage, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (sitemap_dir / "gallery.md").write_text("\n".join(gallery_lines), encoding="utf-8")
    print(json.dumps({"outputDir": str(output_dir), "captureRecords": len(all_records), "eligibleRecords": sum(1 for record in all_records if record.get("auditEligible", True)), "latestStateViewportCount": len(latest), "diagnosticExclusions": len(excluded), "livePublicRecords": len(live_public), "routeRows": len(coverage_rows), "distinctRoutePaths": len({r.get('path') for r in source_routes})}, indent=2))


if __name__ == "__main__":
    main()
