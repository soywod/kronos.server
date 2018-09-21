#!/bin/sh

# if [ "$NODE_ENV" -eq "production" ]; then
# 
# else
# fi

node_modules/.bin/ts-node-dev --project tsconfig.json src/index.ts
