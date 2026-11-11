# Wirasat Saathi on Google Cloud Run. No dependencies to install.
FROM node:22-slim
WORKDIR /app
COPY package.json server.js ./
COPY public ./public
ENV NODE_ENV=production
# Cloud Run provides PORT; set GEMINI_API_KEY as a service environment variable or secret.
CMD ["node", "server.js"]
