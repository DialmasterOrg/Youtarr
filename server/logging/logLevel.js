// Levels the Settings page offers. '' (Default) defers to LOG_LEVEL.
const SETTING_LEVELS = ['warn', 'info', 'debug'];
const DEFAULT_ENV_LEVEL = 'info';

function normalizeLevelSetting(value) {
  if (typeof value !== 'string') return '';
  const cleaned = value.trim().toLowerCase();
  return SETTING_LEVELS.includes(cleaned) ? cleaned : '';
}

function isValidLevelSetting(value) {
  return value === '' || SETTING_LEVELS.includes(value);
}

function resolveLevel({ setting, envLevel }) {
  const normalized = normalizeLevelSetting(setting);
  if (normalized) {
    return { level: normalized, source: 'setting' };
  }
  return { level: envLevel, source: 'env' };
}

module.exports = {
  SETTING_LEVELS,
  DEFAULT_ENV_LEVEL,
  normalizeLevelSetting,
  isValidLevelSetting,
  resolveLevel,
};
