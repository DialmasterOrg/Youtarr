# ---- Base Node ----
FROM node:20 AS base
ENV PATH="/usr/local/bin:/usr/local:$PATH"
WORKDIR /app

# ---- MariaDB Binary Stage ----
# This stage is separate so MariaDB download is cached independently
FROM node:20 AS mariadb-binary
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Download and extract MariaDB 10.3 binary (using non-systemd version which is smaller)
# This layer will be cached unless the MariaDB URL changes
RUN mkdir -p /opt/mariadb && \
    curl --retry 3 --retry-delay 5 -fsSL "https://downloads.mariadb.org/rest-api/mariadb/10.3.39/mariadb-10.3.39-linux-x86_64.tar.gz" \
    -o /tmp/mariadb-10.3.tar.gz && \
    tar -xzf /tmp/mariadb-10.3.tar.gz -C /opt/mariadb --strip-components=1 && \
    rm /tmp/mariadb-10.3.tar.gz

# ---- System Dependencies Stage ----
# Install system packages that rarely change
FROM base AS system-deps
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libaio1 \
    libzstd1 \
    liblz4-1 \
    libncurses6 \
    psmisc \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install libncurses5 dependencies for MariaDB client
RUN wget --timeout=10 --tries=3 --retry-connrefused \
        http://archive.ubuntu.com/ubuntu/pool/universe/n/ncurses/libtinfo5_6.3-2ubuntu0.1_amd64.deb \
    && wget --timeout=10 --tries=3 --retry-connrefused \
        http://archive.ubuntu.com/ubuntu/pool/universe/n/ncurses/libncurses5_6.3-2ubuntu0.1_amd64.deb \
    && dpkg -i libtinfo5_6.3-2ubuntu0.1_amd64.deb \
    && dpkg -i libncurses5_6.3-2ubuntu0.1_amd64.deb \
    && rm libtinfo5_6.3-2ubuntu0.1_amd64.deb libncurses5_6.3-2ubuntu0.1_amd64.deb

# Download the latest yt-dlp release directly from GitHub
RUN wget --timeout=10 --tries=3 https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux -O /usr/local/bin/yt-dlp && \
    chmod +x /usr/local/bin/yt-dlp

# ---- Node Dependencies Stage ----
FROM system-deps AS node-deps
COPY package*.json ./
RUN npm ci --only=production

# ---- Build Stage ----
FROM system-deps AS build
COPY package*.json ./
RUN npm ci

# Copy MariaDB binary from the mariadb-binary stage
COPY --from=mariadb-binary /opt/mariadb /opt/mariadb

# Create necessary directories and set up MariaDB environment
RUN mkdir -p /run/mysqld /var/lib/mysql && \
    useradd -r -s /bin/false mysql || true && \
    chown -R mysql:mysql /run/mysqld /var/lib/mysql

# Set MariaDB binary path
ENV PATH="/opt/mariadb/bin:$PATH"

# Copy server code and built React app into the Docker image
# Note that this causes us to be reliant on the client being built before we run the Dockerfile build
COPY server/ ./server/
COPY client/build/ ./client/build/

# Create MariaDB configuration file since we're using binaries
RUN mkdir -p /etc/mysql && \
    echo "[mysqld]" > /etc/mysql/my.cnf && \
    echo "bind-address = 0.0.0.0" >> /etc/mysql/my.cnf && \
    echo "port = 3321" >> /etc/mysql/my.cnf && \
    echo "datadir = /var/lib/mysql" >> /etc/mysql/my.cnf && \
    echo "socket = /run/mysqld/mysqld.sock" >> /etc/mysql/my.cnf && \
    echo "pid-file = /run/mysqld/mysqld.pid" >> /etc/mysql/my.cnf && \
    echo "user = mysql" >> /etc/mysql/my.cnf && \
    echo "" >> /etc/mysql/my.cnf && \
    echo "[client]" >> /etc/mysql/my.cnf && \
    echo "port = 3321" >> /etc/mysql/my.cnf && \
    echo "socket = /run/mysqld/mysqld.sock" >> /etc/mysql/my.cnf

# Copy the DB initialization and entrypoint scripts into the Docker image
COPY scripts/start_mariadb.sh /usr/local/bin/
COPY scripts/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/start_mariadb.sh /usr/local/bin/docker-entrypoint.sh

# Expose port for the application
EXPOSE 3011
EXPOSE 3321

# Use the entrypoint script that handles graceful shutdown
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]