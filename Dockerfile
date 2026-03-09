FROM node:20-alpine

# Install native build tools needed for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install dependencies first (layer cache)
COPY package.json ./
RUN npm install --omit=dev

# Copy application source
COPY . .

# The SQLite DB lives on a Fly persistent volume mounted at /data
# Point the app at it via environment variable (read in server/db/init.js)
ENV DB_PATH=/data/lord.db

EXPOSE 3000

CMD ["npm", "start"]
