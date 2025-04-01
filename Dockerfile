# Use an official Node.js runtime as a parent image
FROM node:lts-slim

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (or yarn.lock)
# Use package-lock.json for npm ci
COPY package*.json ./

# Install only production dependencies using npm ci for clean installs
RUN npm ci --only=production

# Copy the rest of the application source code
# Note: .dockerignore should prevent node_modules etc. from being copied
COPY . .

# Make port 3000 available to the world outside this container
EXPOSE 3000

# Add a healthcheck (optional but recommended)
# This checks if the server responds on the root path every 30s
HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost:3000/ || exit 1

# Define the command to run your app using node
CMD [ "node", "server.js" ] 