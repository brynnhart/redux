# Simple, production-friendly Node image
FROM node:20-alpine

WORKDIR /server

# Install deps first (better cache)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the app
COPY . .

# Environment (Fly will also inject PORT)
ENV NODE_ENV=production
ENV PORT=3000
# IMPORTANT: your server.js should read DB_PATH; we'll mount a volume at /data
ENV DB_PATH=/data/dis.sqlite3
ENV ROCKO_MODEL=gpt-4.1-mini

EXPOSE 3000

# Run the BBS
CMD ["node", "index.js"]
