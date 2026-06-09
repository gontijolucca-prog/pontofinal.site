#!/usr/bin/env python3
"""
Verifica que as páginas de aprovação gémeas estão em sincronia.

Regra twin-sync: toda a melhoria UX/JS/CSS aplica-se às DUAS páginas no
mesmo commit. Só podem divergir: config.js (identidade do cliente),
data/ (conteúdo), version.txt (bump independente) e brands/ (duplicados
mortos, a abater).

Exit 1 + lista de divergências se houver drift.
"""

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TWINS = [
    os.path.join(ROOT, "public", "aprovacao-tb-202605"),
    os.path.join(ROOT, "public", "aprovacao-luiz-202605"),
]
EXCLUDE_REL = {"js/config.js", "version.txt"}
EXCLUDE_DIRS = {"data", "brands", ".git", "__pycache__", "node_modules"}


def collect(page_dir):
    files = {}
    for root, dirs, names in os.walk(page_dir):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for name in names:
            if name == ".DS_Store":
                continue
            full = os.path.join(root, name)
            rel = os.path.relpath(full, page_dir)
            if rel in EXCLUDE_REL:
                continue
            with open(full, "rb") as f:
                files[rel] = f.read()
    return files


def main():
    a, b = collect(TWINS[0]), collect(TWINS[1])
    name_a, name_b = os.path.basename(TWINS[0]), os.path.basename(TWINS[1])
    problems = []
    for rel in sorted(set(a) | set(b)):
        if rel not in a:
            problems.append(f"só existe em {name_b}: {rel}")
        elif rel not in b:
            problems.append(f"só existe em {name_a}: {rel}")
        elif a[rel] != b[rel]:
            problems.append(f"conteúdo difere: {rel}")
    if problems:
        print(f"✗ gémeas dessincronizadas ({len(problems)}):")
        for p in problems:
            print(f"  - {p}")
        print("\nAplicar a alteração às duas páginas no mesmo commit (regra twin-sync).")
        sys.exit(1)
    print(f"✓ gémeas em sincronia ({len(a)} ficheiros comparados)")


if __name__ == "__main__":
    main()
