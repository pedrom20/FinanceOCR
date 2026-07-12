# Este Dockerfile espera que o contexto de build seja a RAIZ do repositório
# (não a pasta api/), para conseguir compilar o frontend React e servi-lo
# a partir do mesmo container que a API.

# --- Fase 1: build do frontend (Vite/React) ---
FROM node:22-slim AS frontend-build
WORKDIR /app

# Vite embebe estas variáveis no JS final durante o build, por isso têm de
# chegar como build-args (marca-as como "Build Variable" no Coolify).
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET \
    VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID \
    VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# --- Fase 2: runtime da API + frontend compilado ---
FROM node:22-slim
WORKDIR /app

COPY api/package*.json ./
RUN npm install --omit=dev

COPY api/ .
COPY --from=frontend-build /app/dist /dist

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "healthcheck.js"]

CMD ["node", "server.js"]
