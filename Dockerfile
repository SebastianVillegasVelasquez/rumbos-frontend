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

ARG VITE_API_BASE_URL
ARG VITE_API_PROXY_TARGET
ARG VITE_ACTIVITY_OPEN_MODE
ARG VITE_USE_MOCK_API

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_API_PROXY_TARGET=${VITE_API_PROXY_TARGET}
ENV VITE_ACTIVITY_OPEN_MODE=${VITE_ACTIVITY_OPEN_MODE}
ENV VITE_USE_MOCK_API=${VITE_USE_MOCK_API}

RUN pnpm tsc --noEmit && pnpm build

FROM nginxinc/nginx-unprivileged:1.26-alpine-slim AS runner

COPY --from=builder /app/dist /usr/share/nginx/html

COPY ./nginx/nginx.conf /etc/nginx/conf.d/default.conf

USER nginx

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]