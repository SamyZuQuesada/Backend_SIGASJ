FROM node:22.14-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# msnodesqlv8 es nativo de Windows; en Linux no se compila.
ENV npm_config_ignore_scripts=true
RUN npm ci
RUN npm rebuild bcrypt
ENV npm_config_ignore_scripts=

COPY . .

EXPOSE 3000

ENV CHOKIDAR_USEPOLLING=true

CMD ["npm", "run", "start:dev"]
