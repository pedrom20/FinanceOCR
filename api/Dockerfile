# Este Dockerfile espera que o contexto de build seja a RAIZ do repositório
# (não a pasta api/), para conseguir compilar o frontend React e servi-lo
# a partir do mesmo container que a API.

# --- Fase 1: build do frontend (Vite/React) ---
FROM node:22-slim AS frontend-build
WORKDIR /app
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
CMD ["node", "server.js"]
