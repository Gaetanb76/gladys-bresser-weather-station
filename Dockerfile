FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src

# Run as the unprivileged "node" user: Gladys gives the receiver's shared
# volume to uid 1000 and strips root of the right to write in it.
USER node

# Default command runs the main (Gladys-facing) process. The companion
# "wu-receiver" container overrides this via the manifest's
# containers[0].command field to run src/receiver.js instead - same
# image, two roles.
CMD ["node", "src/index.js"]
