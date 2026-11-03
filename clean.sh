#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Recursively delete LaTeX intermediates under ROOT (keep .tex / .pdf)
latex_count=0
while IFS= read -r -d '' f; do
  rm -f "$f"
  latex_count=$((latex_count + 1))
done < <(
  find "$ROOT" \
    \( -path '*/.git' -o -path '*/.git/*' \) -prune -o \
    -type f \( \
      -name '*.aux' -o \
      -name '*.log' -o \
      -name '*.fls' -o \
      -name '*.fdb_latexmk' -o \
      -name '*.xdv' -o \
      -name '*.out' -o \
      -name '*.toc' -o \
      -name '*.lof' -o \
      -name '*.lot' -o \
      -name '*.nav' -o \
      -name '*.snm' -o \
      -name '*.vrb' -o \
      -name '*.bcf' -o \
      -name '*.run.xml' -o \
      -name '*.bbl' -o \
      -name '*.blg' -o \
      -name '*.idx' -o \
      -name '*.ilg' -o \
      -name '*.ind' -o \
      -name '*.glo' -o \
      -name '*.gls' -o \
      -name '*.glg' -o \
      -name '*.acn' -o \
      -name '*.acr' -o \
      -name '*.alg' -o \
      -name '*.ist' -o \
      -name '*.xdy' -o \
      -name '*.dvi' -o \
      -name '*.ps' -o \
      -name '*.bak' -o \
      -name '*.tmp' -o \
      -name '*.temp' -o \
      -name '*.synctex' -o \
      -name '*.synctex.gz' -o \
      -name '*.synctex(busy)' -o \
      -name '*~' \
    \) -print0
)

# Only Mathstalents/paperN/ (exact paper3, paper4, ...): keep whitelist only
paper_count=0
for paper in "$ROOT"/Mathstalents/paper[0-9]*; do
  [ -d "$paper" ] || continue
  case "$(basename "$paper")" in
    paper[0-9]|paper[0-9][0-9]) ;;
    *) continue ;;
  esac
  while IFS= read -r -d '' item; do
    base="$(basename "$item")"
    case "$base" in
      assets|main.pdf|main.tex|questions.tex|solutions.tex) continue ;;
    esac
    rm -rf "$item"
    paper_count=$((paper_count + 1))
    printf '  removed %s\n' "${item#$ROOT/}"
  done < <(find "$paper" -mindepth 1 -maxdepth 1 -print0)
done

printf 'Removed %d LaTeX temp file(s), %d extra file(s)/dir(s) in paper*\n' \
  "$latex_count" "$paper_count"
