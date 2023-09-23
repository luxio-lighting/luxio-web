FROM node:18
COPY ./lib/ /app/lib/
COPY ./routes/ /app/routes/
COPY ./services/ /app/services/
COPY \
  ./package.json \
  ./package-lock.json \
  ./config.js \
  ./server.js \
  /app/
WORKDIR /app/
RUN npm ci --production
ENV DEBUG="Server,Database,LuxioOTA,LuxioNUPNP"
CMD ["node", "server.js"]