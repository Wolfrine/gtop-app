#!/usr/bin/env python3
"""Stop/completion check for GTOP product-memory rules.

Fails when wiki/product-memory files are left dirty or when local main contains
unpushed product-memory commits. Intended for Codex stop hooks and manual
pre-final checks.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


PRODUCT_MEMORY_PREFIXES = (
    "wiki/",
    "raw/",
    "skills/wiki-curator/",
)

PRODUCT_MEMORY_EXACT = {
    "AGENTS.md",
    "codex/WIKI_PROJECT_RULES.md",
    "codex/WIKI_CURATION_LEDGER.md",
    ".codex/hooks/gtop_stop_check.py",
}


def run_git(args: list[str]) -> str:
    result = subprocess.run(
        ["git", *args],
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if result.returncode != 0:
        return ""
    return result.stdout.strip()


def normalize(path: str) -> str:
    return path.replace("\\", "/").strip('"')


def is_product_memory_path(path: str) -> bool:
    path = normalize(path)
    return path in PRODUCT_MEMORY_EXACT or path.startswith(PRODUCT_MEMORY_PREFIXES)


def porcelain_paths() -> list[str]:
    output = run_git(["status", "--porcelain=v1"])
    paths: list[str] = []
    for line in output.splitlines():
        if not line:
            continue
        raw_path = line[2:].strip()
        if " -> " in raw_path:
            paths.extend(raw_path.split(" -> ", 1))
        else:
            paths.append(raw_path)
    untracked = run_git(
        [
            "ls-files",
            "--others",
            "--exclude-standard",
            "--",
            "AGENTS.md",
            "codex/WIKI_PROJECT_RULES.md",
            "codex/WIKI_CURATION_LEDGER.md",
            "wiki",
            "raw",
            "skills/wiki-curator",
            ".codex/hooks/gtop_stop_check.py",
        ]
    )
    paths.extend(line for line in untracked.splitlines() if line.strip())
    return [normalize(path) for path in paths]


def changed_paths_between(left: str, right: str) -> list[str]:
    output = run_git(["diff", "--name-only", f"{left}..{right}"])
    return [normalize(line) for line in output.splitlines() if line.strip()]


def current_branch() -> str:
    return run_git(["branch", "--show-current"])


def main() -> int:
    repo_root = run_git(["rev-parse", "--show-toplevel"])
    if repo_root:
        Path(repo_root)

    dirty_memory = [path for path in porcelain_paths() if is_product_memory_path(path)]
    if dirty_memory:
        print("GTOP wiki-memory gate failed: product-memory files are not committed:")
        for path in dirty_memory:
            print(f"- {path}")
        print("Commit these on main and push main before claiming completion.")
        return 2

    branch = current_branch()
    if branch == "main":
        run_git(["fetch", "origin", "main"])
        ahead_output = run_git(["rev-list", "--left-right", "--count", "origin/main...HEAD"])
        try:
            _behind, ahead = [int(part) for part in ahead_output.split()]
        except ValueError:
            ahead = 0
        if ahead:
            ahead_memory = [
                path
                for path in changed_paths_between("origin/main", "HEAD")
                if is_product_memory_path(path)
            ]
            if ahead_memory:
                print("GTOP wiki-memory gate failed: product-memory commits are not pushed:")
                for path in ahead_memory:
                    print(f"- {path}")
                print("Push main before claiming completion.")
                return 2

    print("GTOP wiki-memory gate passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
