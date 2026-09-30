#!/bin/bash
# Roll the `[Unreleased]` section of CHANGELOG.md into a released version section.
#
# Usage: etc/roll_changelog.sh X.Y.Z [path/to/CHANGELOG.md]
#
# Run by release_action.yml right after the version is extracted from the trigger commit, before
# anything is installed, built or published, so a malformed changelog aborts the release in
# seconds instead of after core is already on npm. It transforms the two `[Unreleased]` markers the
# file must contain (and nothing else):
#
#   ## [Unreleased]                            ->  ## [Unreleased]
#                                                  (empty)
#                                                  ## [X.Y.Z] - YYYY-MM-DD
#
#   [Unreleased]: <repo>/compare/<prev>...HEAD  ->  [Unreleased]: <repo>/compare/X.Y.Z...HEAD
#                                                  [X.Y.Z]: <repo>/compare/<prev>...X.Y.Z
#
# The resulting edit is committed to main by the workflow's "Update version in git" step together
# with the package.json version bumps.
set -e
set -o pipefail

version="$1"
file="${2:-CHANGELOG.md}"

if ! [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Usage: $0 X.Y.Z [CHANGELOG.md]" >&2
  exit 1
fi

if [ -z "$2" ]; then
  cd "$(dirname "$0")/.."
fi

fail() {
  echo "ERROR: $1" >&2
  echo "Aborting the release: fix $file on main and cut the release again." >&2
  exit 1
}

count=$(grep -c -F '[Unreleased]' "$file" || true)
if [ "$count" -ne 2 ]; then
  grep -n -F '[Unreleased]' "$file" >&2 || true
  fail "expected exactly 2 occurrences of '[Unreleased]' in $file (the section heading and the compare link), found $count"
fi
grep -q -x '## \[Unreleased\]' "$file" \
  || fail "no '## [Unreleased]' section heading in $file"
grep -q -E '^\[Unreleased\]: https?://.*/compare/[^/]+\.\.\.HEAD$' "$file" \
  || fail "no '[Unreleased]: <repo>/compare/<prev-tag>...HEAD' link line in $file"
if grep -q -F "[$version]" "$file"; then
  grep -n -F "[$version]" "$file" >&2
  fail "$file already mentions [$version]"
fi

today=$(date -u +%Y-%m-%d)
tmp="$file.tmp"
awk -v v="$version" -v d="$today" '
  $0 == "## [Unreleased]" {
    print
    print ""
    print "## [" v "] - " d
    next
  }
  /^\[Unreleased\]: / {
    url = $0
    sub(/^\[Unreleased\]: /, "", url)
    prefix = url
    sub(/compare\/.*$/, "compare/", prefix)
    prev = url
    sub(/^.*compare\//, "", prev)
    sub(/\.\.\.HEAD$/, "", prev)
    print "[Unreleased]: " prefix v "...HEAD"
    print "[" v "]: " prefix prev "..." v
    next
  }
  { print }
' "$file" > "$tmp"
mv "$tmp" "$file"

echo "Rolled [Unreleased] in $file into [$version] - $today"
