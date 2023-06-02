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
RUN pip3 install yt-dlp

# Install MariaDB
RUN apt-get install -y mariadb-server

# ---- Copy Files/Build ----
FROM dependencies AS build
# Copy server code and built React app into the Docker image
# Note that this causes us to be reliant on the client being built before we run the Dockerfile build
COPY server/ ./server/
COPY client/build/ ./client/build/

# Allow mariadb to accept connections from host
RUN sed -i 's/bind-address\s*=.*/bind-address = 0.0.0.0/' /etc/mysql/mariadb.conf.d/50-server.cnf
# Modify MariaDB configuration to listen on port 3321
RUN sed -i 's/^#port[ \t]*=[ \t]*3306/port = 3321/' /etc/mysql/mariadb.conf.d/50-server.cnf
RUN cat /etc/mysql/mariadb.conf.d/50-server.cnf

#RUN service mysql restart


# Copy the DB initialization script into the Docker image
COPY scripts/start_mariadb.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/start_mariadb.sh

# Expose port for the application
EXPOSE 3011
EXPOSE 3321

# Run MySQL in the background and start the server
CMD ["sh", "-c", "/usr/local/bin/start_mariadb.sh && node ./server/server.js"]
