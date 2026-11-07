const dns = require('dns');
const net = require('net');
const logger = require('../logger');

const FAMILY_NUMBERS = { IPv4: 4, IPv6: 6 };

/**
 * Opens the TCP socket for each database connection (mysql2's `stream`
 * factory), reusing the last address a connection actually reached.
 *
 * dns.lookup runs on libuv's threadpool, which runs only a couple of
 * lookups at a time. While the internet is down, lookups for internet hosts
 * hang there for ~16 s each, and a database host lookup queued behind them
 * outlasts mysql2's 10 s connect timeout although the database is fine
 * (issue #921). Reusing the known address keeps new connections off that
 * queue. A connection that fails before connecting forgets the address, so
 * a database that moved (container recreated) is looked up again.
 */
class DatabaseSocket {
  constructor() {
    this.knownAddresses = new Map();
    this.connect = this.connect.bind(this);
    this.lookup = this.lookup.bind(this);
  }

  /**
   * @param {Object} opts - mysql2 connection options; host and port are in opts.config
   * @returns {net.Socket}
   */
  connect(opts) {
    const { host, port, enableKeepAlive, keepAliveInitialDelay } = opts.config;
    const socket = net.connect({ host, port, lookup: this.lookup });
    // mysql2 sets no-delay and keep-alive itself only on sockets it opens,
    // so this does the same, the same way.
    socket.setNoDelay(true);

    let connected = false;
    socket.once('connect', () => {
      connected = true;
      if (enableKeepAlive) {
        socket.setKeepAlive(true, keepAliveInitialDelay);
      }
      this.remember(host, socket.remoteAddress, socket.remoteFamily);
    });
    socket.once('close', () => {
      if (!connected) {
        this.forget(host);
      }
    });
    return socket;
  }

  /**
   * net.connect lookup hook: the known address when there is one, else dns.lookup.
   * @param {string} hostname
   * @param {Object} options - net passes { all: true } when it tries several addresses
   * @param {Function} callback
   */
  lookup(hostname, options, callback) {
    const known = this.knownAddresses.get(hostname);
    if (!known) {
      dns.lookup(hostname, options, callback);
      return;
    }
    process.nextTick(() => {
      if (options && options.all) {
        callback(null, [{ address: known.address, family: known.family }]);
      } else {
        callback(null, known.address, known.family);
      }
    });
  }

  remember(host, address, family) {
    if (!address) {
      return;
    }
    const familyNumber = typeof family === 'number' ? family : FAMILY_NUMBERS[family];
    const known = this.knownAddresses.get(host);
    if (known && known.address === address) {
      return;
    }
    this.knownAddresses.set(host, { address, family: familyNumber });
    logger.debug({ host, address }, 'Database host address saved for new connections');
  }

  forget(host) {
    const known = this.knownAddresses.get(host);
    if (!known) {
      return;
    }
    this.knownAddresses.delete(host);
    logger.info(
      { host, address: known.address },
      'Database connection failed at the saved address, looking the host up again'
    );
  }
}

module.exports = new DatabaseSocket();
