# ---- Base Node ----
FROM node:14 AS base
ENV PATH="/usr/local/bin:$PATH"
WORKDIR /app
COPY package*.json ./

# ---- Dependencies ----
FROM base AS dependencies
RUN npm install 
RUN apt-get update && apt-get install -y ffmpeg
RUN apt-get install -y python3-pip
RUN pip3 install --user pip

# This next command fails with pip not found...
RUN pip3 install yt-dlp

# ---- Copy Files/Build ----
FROM dependencies AS build
# Copy server code and built React app into the Docker image
COPY server/ ./server/
COPY client/build/ ./client/build/


EXPOSE 3011

# Set the command to start the server
CMD ["node", "./server/server.js"]