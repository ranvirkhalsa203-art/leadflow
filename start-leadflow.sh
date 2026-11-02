#!/usr/bin/env sh
set -eu
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js 22.13 or newer, then run this script again."
  exit 1
fi
node -e 'const [major,minor]=process.versions.node.split(".").map(Number); if(major<22 || (major===22 && minor<13)) process.exit(1)' || {
  echo "LeadFlow needs Node.js 22.13 or newer."
  exit 1
}
if [ ! -d node_modules ]; then npm ci; fi
npm run dev
