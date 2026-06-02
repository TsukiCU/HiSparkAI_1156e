#!/bin/bash

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <version>"
    exit 1
fi

version="$1"

echo "$version"

files=(
    "resources/releasenotes.json"
    "dist/releasenote-Version-HiSparkStudioAI.html"
    "dist/releasenote-all.html"
    "src/i18n/lang/en.json"
    "src/i18n/lang/zh.json"
)

for file in "${files[@]}"; do
    sed -i "s/Version-HiSparkStudioAI/$version/g" "$file"
done

mv "dist/releasenote-Version-HiSparkStudioAI.html" "dist/releasenote-$version.html"