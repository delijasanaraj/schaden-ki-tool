#!/bin/bash
export PATH="$HOME/.nvm/versions/node/v24.18.1/bin:$PATH"
cd "$(dirname "$0")"
exec npm run dev
