"""Read-only candidate inspection; writes only this critic's review manifest."""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent

def record(path):
    return {"path": path.relative_to(ROOT).as_posix(), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}

build = sorted((ROOT / "question-papers/dist/question-papers/browser").rglob("*"))
build = [record(p) for p in build if p.is_file()]
sources = [record(p) for p in sorted((ROOT / "question-papers/src").iterdir()) if p.is_file()]
fixtures = [r for r in sources if r["path"].endswith("/dev-transport.ts")]
binding = {"production_build": build, "fixture_sources": fixtures}
candidate = hashlib.sha256(json.dumps(binding, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
evidence = [record(p) for p in sorted(OUT.rglob("*.png"))]
manifest = {"candidate_algorithm": "sha256(canonical_json({production_build:[path,sha256],fixture_sources:[path,sha256]})); sorted keys and compact separators", "candidate": candidate, "production_build": build, "source_snapshot": sources, "screenshots": evidence, "evidence_truth": "Critic-created localhost browser captures; signed-in workflow data is explicit synthetic fixture data. Production build sign-in gate viewed without credentials or sign-in."}
(OUT / "candidate-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"candidate": candidate, "source_files":len(sources), "build_files":len(build), "screenshots":len(evidence)}))
