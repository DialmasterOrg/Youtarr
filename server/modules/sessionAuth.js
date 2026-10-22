const db = require('../db');

class SessionAuth {
  // The one definition of a usable session token, shared by HTTP requests
  // (verifyToken) and WebSocket connections.
  async findActiveSession(token) {
    if (typeof token !== 'string' || token === '') {
      return null;
    }

    return db.Session.findOne({
      where: {
        session_token: token,
        is_active: true,
        expires_at: {
          [db.Sequelize.Op.gt]: new Date()
        }
      }
    });
  }
}

module.exports = new SessionAuth();
