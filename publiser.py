#!/usr/bin/env python3
"""Bygg og publiser Almanakk v2 til Cloudflare Pages (prosjekt almanakk-v2).

    python3 publiser.py --bygg        # bare bygg dist/ (trygt, laster ingenting opp)
    python3 publiser.py --prov        # kjør lokalt: wrangler pages dev, med PROVE=alan@...
    python3 publiser.py --preview     # publiser til preview.almanakk-v2.pages.dev (rører ikke prod)
    python3 publiser.py               # bygg og publiser til PRODUKSJON (spør først)

Hvorfor et byggesteg: repoet inneholder Front/ og inventory/ med Alans
personlige kalenderdata. De skal ALDRI opp på Pages. Derfor kopieres bare
v2/ + motoren (gcal.js, airports.js, config.js, demo-data.js, ikoner) til
dist/, og dist/ er det eneste som lastes opp. functions/ ligger ved siden av,
slik wrangler venter.
"""
import argparse, pathlib, re, shutil, subprocess, sys

HER  = pathlib.Path(__file__).parent
DIST = HER / "dist"
MOTOR = ["gcal.js", "airports.js", "config.js", "demo-data.js",
         "icon-192-v2.png", "icon-512-v2.png", "icon.svg"]
PROVE_EPOST = "alan@winterguests.com"

def bygg():
    if DIST.exists(): shutil.rmtree(DIST)
    (DIST / "v2").mkdir(parents=True)
    for f in MOTOR: shutil.copy2(HER / f, DIST / f)
    for f in (HER / "v2").iterdir():
        if f.is_file(): shutil.copy2(f, DIST / "v2" / f.name)
    # på Cloudflare går innloggingen via /api — slå proxymodus på i denne kopien
    idx = DIST / "v2" / "index.html"
    s = idx.read_text(encoding="utf-8")
    s, n = re.subn(r"<script>window\.ALMANAKK_PROXY = null;</script>",
                   "<script>window.ALMANAKK_PROXY = '/api/gcal';</script>", s)
    if n != 1: sys.exit("fant ikke ALMANAKK_PROXY-merket i v2/index.html")
    # GIS trengs ikke når nøkkelen ligger på Cloudflare
    s = re.sub(r'\s*<script src="https://accounts\.google\.com/gsi/client"[^>]*></script>', "", s)
    idx.write_text(s, encoding="utf-8")
    (DIST / "_redirects").write_text("/  /v2/  302\n", encoding="utf-8")
    # aldri personlige mapper: sjekk før noe lastes opp
    for p in DIST.rglob("*"):
        assert "Front" not in p.parts and "inventory" not in p.parts, p
    print(f"bygd {DIST}: {sum(1 for _ in DIST.rglob('*') if _.is_file())} filer")

def main():
    a = argparse.ArgumentParser()
    a.add_argument("--bygg", action="store_true")
    a.add_argument("--prov", action="store_true")
    a.add_argument("--preview", action="store_true",
                   help="egen adresse bak samme innlogging; Alan bruker prod daglig, så alt nytt går hit først")
    a = a.parse_args()
    bygg()
    if a.bygg: return
    if a.prov:
        subprocess.run(["npx", "-y", "wrangler@latest", "pages", "dev", str(DIST),
                        "--kv", "KV", "--binding", f"PROVE={PROVE_EPOST}", "--port", "8124"], cwd=HER)
        return
    if a.preview:
        r = subprocess.run(["npx", "-y", "wrangler@latest", "pages", "deploy", str(DIST),
                            "--project-name", "almanakk-v2", "--branch", "preview", "--commit-dirty=true"], cwd=HER)
        print("\npreview: https://preview.almanakk-v2.pages.dev/v2/  (samme innlogging; prod uendret)")
        sys.exit(r.returncode)
    if input("Publisere almanakk-v2 til PRODUKSJON? Alan bruker den daglig. [ja/N] ").strip().lower() != "ja":
        sys.exit("avbrutt")
    r = subprocess.run(["npx", "-y", "wrangler@latest", "pages", "deploy", str(DIST),
                        "--project-name", "almanakk-v2", "--commit-dirty=true"], cwd=HER)
    sys.exit(r.returncode)

if __name__ == "__main__": main()
