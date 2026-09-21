FROM node:24-alpine AS development-dependencies-env
COPY . /app
WORKDIR /app
RUN npm ci

FROM node:24-alpine AS production-dependencies-env
COPY ./package.json package-lock.json /app/
WORKDIR /app
RUN npm ci --omit=dev

FROM node:24-alpine AS build-env
# Vite inlines VITE_* at build time, so this must be supplied to the build,
# not to the running container:  docker build --build-arg VITE_PUTER_WORKER_URL=...
ARG VITE_PUTER_WORKER_URL
ENV VITE_PUTER_WORKER_URL=$VITE_PUTER_WORKER_URL
COPY . /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app
RUN if [ -z "$VITE_PUTER_WORKER_URL" ]; then \
      echo "ERROR: VITE_PUTER_WORKER_URL build arg is required" >&2; exit 1; \
    fi
RUN npm run build

FROM node:24-alpine
COPY ./package.json package-lock.json /app/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
WORKDIR /app
CMD ["npm", "run", "start"]
