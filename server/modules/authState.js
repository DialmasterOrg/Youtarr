function isAuthConfigured(config) {
  return Boolean(config?.username && config?.passwordHash);
}

module.exports = {
  isAuthConfigured
};
