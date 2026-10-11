FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src

# Default command runs the main (Gladys-facing) process. The companion
# "wu-receiver" container overrides this via the manifest's
# containers[0].command field to run src/receiver.js instead - same
# image, two roles.
CMD ["node", "src/index.js"]
