#!/bin/sh
# The spellcheck of the pre-commit hook (its staged files) and of mise run lint:spelling (the whole
# repo when given no file): everything in English (cspell.config.yaml), then the French copy that
# pass leaves out, with the French dictionary (cspell.fr.config.yaml)
set -e
cd "$(dirname "$0")/.."
[ "$#" -eq 0 ] && set -- .
npx cspell lint --no-progress --no-summary --no-must-find-files --dot "$@"
npx cspell lint --config cspell.fr.config.yaml --no-config-search --no-progress --no-summary --no-must-find-files --dot "$@"
