cd ../e-server
npm i && npm run build -- --outDir ../e-app/server
cd -

cd ../e-web
npm i && OUT_DIR=../e-app/web npm run build
cd -

npm i && npm run build
