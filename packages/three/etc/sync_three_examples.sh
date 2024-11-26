#!/bin/bash
SOURCE_A="./node_modules/three/examples/jsm"
SOURCE_B="./node_modules/@types/three/examples/jsm"
TARGET="./src/three-examples"

update_files() {
  local source_dir=$1
  find "$TARGET" -type f | while IFS= read -r target_file; do
    relative_path="${target_file#$TARGET/}"
    source_file="$source_dir/$relative_path"
    if [[ -f "$source_file" && "$source_file" -nt "$target_file" ]]; then
      cp "$source_file" "$target_file"
    fi
  done
}

update_files "$SOURCE_A"
update_files "$SOURCE_B"
