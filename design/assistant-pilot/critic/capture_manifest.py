"""Read-only candidate inspection; writes only this critic's review manifest."""
from pathlib import Path
import hashlib
import json
import subprocess

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent

def record(path):
    return {"path": path.relative_to(ROOT).as_posix(), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}

build = sorted((ROOT / "question-papers/dist/question-papers/browser").rglob("*"))
build = [record(p) for p in build if p.is_file()]
sources = [record(p) for p in sorted((ROOT / "question-papers/src").rglob("*")) if p.is_file()]
fixtures = [r for r in sources if r["path"].endswith("/dev-transport.ts")]
config_names = ["package.json", "package-lock.json", "angular.json", "tsconfig.json", "tsconfig.app.json"]
configs = [record(ROOT / "question-papers" / name) for name in config_names if (ROOT / "question-papers" / name).is_file()]
binding = {"production_build": build, "source_snapshot": sources, "project_configuration": configs, "fixture_sources": fixtures}
candidate = hashlib.sha256(json.dumps(binding, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
evidence = [record(p) for p in sorted(OUT.rglob("*.png"))]
parent_names = ["actual-local-explanation-math-desktop.png", "actual-local-explanation-math-phone.png", "chat-math-safety-fixture-desktop.png", "chat-math-safety-fixture-phone.png", "patched-angular21-actual-chat-desktop.png", "patched-angular21-actual-chat-phone.png", "patched-angular21-actual-answers-phone.png", "patched-angular21-safety-desktop.png", "patched-angular21-safety-phone.png"]
parent_evidence = [record(ROOT / "design/assistant-pilot/parent-qa" / name) for name in parent_names if (ROOT / "design/assistant-pilot/parent-qa" / name).is_file()]
revision = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
manifest = {"candidate_algorithm": "v2: sha256(canonical_json({production_build:[path,sha256],source_snapshot:[path,sha256],project_configuration:[path,sha256],fixture_sources:[path,sha256]})); sorted keys and compact separators", "candidate": candidate, "observed_git_revision": revision, "production_build": build, "source_snapshot": sources, "project_configuration": configs, "screenshots": evidence, "parent_captured_critic_viewed_screenshots": parent_evidence, "evidence_truth": "Historical critic-operated localhost captures include labelled synthetic fixtures and an actual Codex-generated paper/revision viewed with a seeded synthetic administrator in isolated emulators. Chat-math and dependency-regression screenshots were captured through the parent's browser and independently viewed by the critic because the child browser surface was unavailable; they show the retained actual local-model explanation and clearly labelled hostile/malformed synthetic fallback cases. Production sign-in inspection belongs to a prior candidate; current production assets are bound from disk, not claimed as independently browser-loaded by the critic."}
(OUT / "candidate-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"candidate": candidate, "source_files":len(sources), "build_files":len(build), "screenshots":len(evidence)}))
