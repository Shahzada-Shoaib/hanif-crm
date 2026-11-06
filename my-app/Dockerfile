FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app

RUN npm install --global serve@14.2.5 && \
    addgroup --system app && adduser --system --ingroup app app

COPY --from=build --chown=app:app /app/dist ./dist

USER app

EXPOSE 3000

CMD ["serve", "--single", "dist", "--listen", "3000"]
