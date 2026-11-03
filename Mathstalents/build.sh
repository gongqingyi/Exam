#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

build_paper() {
  local folder="$1"
  local output="$2"

  latexmk \
    -xelatex \
    -interaction=nonstopmode \
    -halt-on-error \
    -cd \
    "$ROOT/$folder/main.tex"

  cp "$ROOT/$folder/main.pdf" "$ROOT/$output"
}

build_paper "paper3" "Mathstalents小学版-第三套卷-精编版.pdf"
build_paper "paper4" "Mathstalents小学版-第四套卷-精编版.pdf"
build_paper "paper5" "Mathstalents小学版-第五套卷-精编版.pdf"
build_paper "paper6" "Mathstalents小学版-第六套卷-精编版.pdf"

printf 'Built four PDFs in %s\n' "$ROOT"
