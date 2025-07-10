# Dockerfile pour le service de paiement SupervIA

# ==============================================================================
# ÉTAPE 1: BUILDER
# Installe les dépendances de production dans un environnement propre et isolé.
# ==============================================================================
FROM node:20-alpine AS builder

ENV NODE_ENV=production
WORKDIR /app

# Copie des fichiers de dépendances et installation propre
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copie du code source
COPY src ./src
COPY scripts ./scripts


# ==============================================================================
# ÉTAPE 2: PRODUCTION
# Construit l'image finale légère avec le code et les dépendances.
# ==============================================================================
FROM node:20-alpine

ENV NODE_ENV=production
ENV TZ=Europe/Paris

# Mise à jour et installation des paquets de base
RUN apk add --no-cache tzdata wget

# Création d'un groupe et d'un utilisateur non-root pour la sécurité
RUN addgroup -g 1001 -S nodejs && \
    adduser -S -u 1001 -G nodejs nodeuser

WORKDIR /app

# Copie des dépendances et du code source depuis l'étape de build
COPY --from=builder --chown=nodeuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodejs /app/src ./src
COPY --from=builder --chown=nodeuser:nodejs /app/scripts ./scripts
COPY --chown=nodeuser:nodejs package*.json ./

# Création des répertoires pour les volumes avec les bonnes permissions
RUN mkdir -p logs && \
    chown -R nodeuser:nodejs logs

# Exposition du port
EXPOSE 3006

# Vérification de la santé du conteneur pour l'orchestration Docker
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:3006/api/v1/health || exit 1

# Passage à l'utilisateur non-root pour l'exécution
USER nodeuser

# Commande de démarrage du service
CMD ["node", "src/server.js"] 