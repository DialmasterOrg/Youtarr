const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'youtarr',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '123qweasd',
  {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'mysql',
    port: process.env.DB_PORT || 3321,
    logging: false,
  }
);

const initializeDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');

    // Run migrations
    const Umzug = require('umzug');
    const path = require('path');

    const migrator = new Umzug({
      migrations: {
        path: path.join(__dirname, '../migrations'),
        params: [sequelize.getQueryInterface(), Sequelize],
      },
      storage: 'sequelize',
      storageOptions: {
        sequelize: sequelize,
      },
    });

    await migrator.up();
  } catch (error) {
    console.error('Unable to initialize the database:', error);
    throw error;
  }
};

module.exports = {
  initializeDatabase,
  sequelize,
  Sequelize,
};
