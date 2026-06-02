#!/bin/bash
echo "projectwizard"

mkdir -p ../../../out/vsix

yarn config set strict-ssl false
yarn config set disable-self-update-check true
yarn
yarn pre-launch
vsce package

cp ./*.vsix ../../../out/vsix