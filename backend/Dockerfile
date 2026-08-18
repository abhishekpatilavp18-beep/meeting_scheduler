# ── Build Stage ──────────────────────────────────────────────
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Bundle app source
COPY . .

# Create logs directory
RUN mkdir -p logs && chown node:node logs

# Use non-root user for security
USER node

# Expose the port the app runs on
EXPOSE 5000

# Set environment variables
ENV NODE_ENV=production

# The command to run the app
CMD [ "npm", "start" ]
