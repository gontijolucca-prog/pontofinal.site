#!/usr/bin/env python3
"""
Bump atómico do triplo de versão de uma página de aprovação:
  index.html  <meta name="app-version" content="...">
  js/config.js  export const APP_VERSION = "...";
  version.txt

Se os três divergirem, o version-gate dispara reloads aos clientes — bump
sempre com este script, nunca à mão.

Uso:
  python3 scripts/bump_version.py public/aprovacao-tb-202605 public/aprovacao-luiz-202605
  python3 scripts/bump_version.py --check public/aprovacao-tb-202605   # só valida, exit 1 se divergir
"""

import os
import re
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

META_RE = re.compile(r'(<meta name="app-version" content=")[^"]*(")')
CONFIG_RE = re.compile(r'(export const APP_VERSION = ")[^"]*(")')


def read_triple(page_dir):
    triple = {}
    index_path = os.path.join(page_dir, "index.html")
    config_path = os.path.join(page_dir, "js", "config.js")
    version_path = os.path.join(page_dir, "version.txt")
    if os.path.exists(index_path):
        m = META_RE.search(open(index_path, encoding="utf-8").read())
        triple["index.html"] = m.group(0).split('content="')[1].rstrip('"') if m else None
    if os.path.exists(config_path):
        m = CONFIG_RE.search(open(config_path, encoding="utf-8").read())
        triple["config.js"] = m.group(0).split('= "')[1].rstrip('"') if m else None
    if os.path.exists(version_path):
        triple["version.txt"] = open(version_path, encoding="utf-8").read().strip()
    return triple


def bump(page_dir, version):
    index_path = os.path.join(page_dir, "index.html")
    config_path = os.path.join(page_dir, "js", "config.js")
    version_path = os.path.join(page_dir, "version.txt")

    html = open(index_path, encoding="utf-8").read()
    html, n1 = META_RE.subn(rf"\g<1>{version}\g<2>", html)
    open(index_path, "w", encoding="utf-8").write(html)

    cfg = open(config_path, encoding="utf-8").read()
    cfg, n2 = CONFIG_RE.subn(rf"\g<1>{version}\g<2>", cfg)
    open(config_path, "w", encoding="utf-8").write(cfg)

    open(version_path, "w", encoding="utf-8").write(version + "\n")

    if n1 != 1 or n2 != 1:
        print(f"ERRO {page_dir}: padrões encontrados meta={n1} config={n2} (esperado 1+1)")
        sys.exit(1)
    print(f"✓ {page_dir} → {version}")


def main():
    args = [a for a in sys.argv[1:] if a != "--check"]
    check_only = "--check" in sys.argv
    if not args:
        print(__doc__)
        sys.exit(1)

    failed = False
    version = datetime.now(ZoneInfo("Europe/Lisbon")).strftime("%Y%m%d-%H%M")
    for page_dir in args:
        if not os.path.isdir(page_dir):
            print(f"ERRO: {page_dir} não é pasta")
            sys.exit(1)
        triple = read_triple(page_dir)
        if check_only:
            ok = len(set(triple.values())) == 1 and None not in triple.values()
            print(f"{'✓' if ok else '✗'} {page_dir}: {triple}")
            failed = failed or not ok
        else:
            bump(page_dir, version)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
