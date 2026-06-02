#!/bin/bash
echo "EvaluationGui"
set -eux
set -o pipefail
version=$1
sed -i "s/\"version\":.*/\"version\": \"$version\",/" ./package.json
bash version_set.sh $version
yarn config set strict-ssl false
yarn config set disable-self-update-check true
yarn
yarn compile
yarn run vscode:package