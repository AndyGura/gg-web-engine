#!/usr/bin/env bash
# Builds a validated, installable extension zip from gg_web_engine_exporter/.
#
# Uses Blender's own extension packager rather than a plain `zip` invocation:
# `blender --command extension build` validates blender_manifest.toml against
# Blender's schema and lays the zip out the way Install-from-Disk/the Extensions
# Platform expect, which a hand-rolled zip is easy to get subtly wrong (extra
# top-level directory, missing/invalid manifest fields, etc.) - build it here,
# don't reimplement it in shell.
#
# Requires a `blender` binary on PATH (any Blender 4.2+ works as the builder,
# regardless of blender_version_min in the manifest).
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p dist
blender --command extension build \
  --source-dir=gg_web_engine_exporter \
  --output-dir=dist

echo "Built: $(ls -t dist/*.zip | head -1)"
