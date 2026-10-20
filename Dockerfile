FROM node:24-alpine AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

COPY ./package.json ./pnpm-lock.yaml ./

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json tsconfig.test.json ./
COPY ./src ./src/
COPY ./public ./public/
COPY ./3d ./3d/

ARG VITE_API_BASE_URL
ARG VITE_API_PROXY_TARGET
ARG VITE_ACTIVITY_OPEN_MODE
ARG VITE_USE_MOCK_API
ARG VITE_SHOW_BUNDLED_BACKGROUNDS
ARG RUMBOS_BUILD_COMMIT

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_API_PROXY_TARGET=${VITE_API_PROXY_TARGET}
ENV VITE_ACTIVITY_OPEN_MODE=${VITE_ACTIVITY_OPEN_MODE}
ENV VITE_USE_MOCK_API=${VITE_USE_MOCK_API}
ENV VITE_SHOW_BUNDLED_BACKGROUNDS=${VITE_SHOW_BUNDLED_BACKGROUNDS}
ENV RUMBOS_BUILD_COMMIT=${RUMBOS_BUILD_COMMIT}


RUN pnpm tsc --noEmit && pnpm build

FROM nginxinc/nginx-unprivileged:1.26-alpine-slim AS runner

COPY --from=builder /app/dist /usr/share/nginx/html

# A template: the image's entrypoint substitutes ${EMBED_FRAME_ANCESTORS} (and
# only the variables that are set) when the container starts.
COPY ./nginx/nginx.conf /etc/nginx/templates/default.conf.template

# Origins allowed to frame /embed and /3d/: the registered Moodle sites, for
# example "https://moodle.example.edu https://campus.example.org". Framing by
# anyone else is refused.
ENV EMBED_FRAME_ANCESTORS="'self'"

USER nginx

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]