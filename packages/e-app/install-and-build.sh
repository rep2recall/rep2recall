#!/bin/bash

cd ../e-server
npm i && npm run build -- --outDir ../e-app/server
cd -

cd ../e-web
npm i && npm run build -- --dest ../e-app/web
cd -

npm i && npm run build
