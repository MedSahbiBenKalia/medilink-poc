# Image unique pour les deux services (plan B "tout sur un PC").
# Service Patient :    docker run ... medilink-tache2                       (par defaut)
# Service Couverture : docker run ... medilink-tache2 node src/couverture/server.js
# La configuration passe par les variables d'environnement (voir .env.example).
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
EXPOSE 8091 8092
CMD ["node", "src/patient/server.js"]
