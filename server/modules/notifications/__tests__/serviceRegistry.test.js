/* eslint-env jest */

const {
  getServiceForUrl,
  supportsRichFormatting,
  getDefaultNameForUrl,
  isDiscord,
  isDiscordWebhook,
  getRichFormattingServices,
  getAllServices
} = require('../serviceRegistry');

describe('Service Registry', () => {
  describe('getServiceForUrl', () => {
    it('should detect Discord Apprise URLs', () => {
      const service = getServiceForUrl('discord://123456/abcdef');
      expect(service.key).toBe('discord');
      expect(service.name).toBe('Discord');
    });

    it('should detect Discord HTTP webhook URLs', () => {
      const service = getServiceForUrl('https://discord.com/api/webhooks/123/abc');
      expect(service.key).toBe('discord');
    });

    it('should detect discordapp.com URLs', () => {
      const service = getServiceForUrl('https://discordapp.com/api/webhooks/123/abc');
      expect(service.key).toBe('discord');
    });

    it('should detect Slack Apprise URLs', () => {
      const service = getServiceForUrl('slack://tokenA/tokenB/tokenC');
      expect(service.key).toBe('slack');
      expect(service.name).toBe('Slack');
    });

    it('should detect Slack HTTP webhook URLs', () => {
      const service = getServiceForUrl('https://hooks.slack.com/services/xxx');
      expect(service.key).toBe('slack');
    });

    it('should detect Telegram URLs', () => {
      expect(getServiceForUrl('tgram://bot123/chatid').key).toBe('telegram');
      expect(getServiceForUrl('telegram://bot123/chatid').key).toBe('telegram');
    });

    it('should detect Email URLs', () => {
      expect(getServiceForUrl('mailto://user:pass@gmail.com').key).toBe('email');
      expect(getServiceForUrl('mailtos://user:pass@gmail.com').key).toBe('email');
    });

    it('should detect Pushover URLs', () => {
      expect(getServiceForUrl('pover://user@token').key).toBe('pushover');
      expect(getServiceForUrl('pushover://user@token').key).toBe('pushover');
    });

    it('should detect Gotify URLs', () => {
      expect(getServiceForUrl('gotify://host/token').key).toBe('gotify');
      expect(getServiceForUrl('gotifys://host/token').key).toBe('gotify');
    });

    it('should detect Ntfy URLs', () => {
      expect(getServiceForUrl('ntfy://topic').key).toBe('ntfy');
      expect(getServiceForUrl('ntfys://host/topic').key).toBe('ntfy');
    });

    it('should detect Matrix URLs', () => {
      expect(getServiceForUrl('matrix://user:pass@host').key).toBe('matrix');
      expect(getServiceForUrl('matrixs://user:pass@host').key).toBe('matrix');
    });

    it('should detect Mattermost URLs', () => {
      expect(getServiceForUrl('mmost://host/token').key).toBe('mattermost');
    });

    it('should return generic for unknown URLs', () => {
      const service = getServiceForUrl('unknown://something');
      expect(service.key).toBe('generic');
      expect(service.name).toBe('Notification Service');
    });

    it('should return generic for null/undefined', () => {
      expect(getServiceForUrl(null).key).toBe('generic');
      expect(getServiceForUrl(undefined).key).toBe('generic');
    });
  });

  describe('supportsRichFormatting', () => {
    it('should return true for Discord', () => {
      expect(supportsRichFormatting('discord://123/abc')).toBe(true);
      expect(supportsRichFormatting('https://discord.com/api/webhooks/123/abc')).toBe(true);
    });

    it('should return true for Slack', () => {
      expect(supportsRichFormatting('slack://a/b/c')).toBe(true);
    });

    it('should return true for Telegram', () => {
      expect(supportsRichFormatting('tgram://bot/chat')).toBe(true);
    });

    it('should return true for Email', () => {
      expect(supportsRichFormatting('mailto://user:pass@host')).toBe(true);
    });

    it('should return false for Pushover', () => {
      expect(supportsRichFormatting('pover://user@token')).toBe(false);
    });

    it('should return false for Ntfy', () => {
      expect(supportsRichFormatting('ntfy://topic')).toBe(false);
    });

    it('should return false for unknown services', () => {
      expect(supportsRichFormatting('unknown://foo')).toBe(false);
    });
  });

  describe('getDefaultNameForUrl', () => {
    it('should return Discord for Discord URLs', () => {
      expect(getDefaultNameForUrl('discord://123/abc')).toBe('Discord');
    });

    it('should return Slack for Slack URLs', () => {
      expect(getDefaultNameForUrl('slack://a/b/c')).toBe('Slack');
    });

    it('should return Telegram for Telegram URLs', () => {
      expect(getDefaultNameForUrl('tgram://bot/chat')).toBe('Telegram');
    });

    it('should return Email for Email URLs', () => {
      expect(getDefaultNameForUrl('mailto://user:pass@host')).toBe('Email');
    });

    it('should return Notification Service for unknown URLs', () => {
      expect(getDefaultNameForUrl('unknown://foo')).toBe('Notification Service');
    });
  });

  describe('isDiscord', () => {
    it('should return true for discord:// URLs', () => {
      expect(isDiscord('discord://123/abc')).toBe(true);
    });

    it('should return true for discord.com webhook URLs', () => {
      expect(isDiscord('https://discord.com/api/webhooks/123/abc')).toBe(true);
    });

    it('should return false for other URLs', () => {
      expect(isDiscord('slack://a/b/c')).toBe(false);
      expect(isDiscord('ntfy://topic')).toBe(false);
    });
  });

  describe('isDiscordWebhook', () => {
    it('should return true for discord.com webhook URLs', () => {
      expect(isDiscordWebhook('https://discord.com/api/webhooks/123/abc')).toBe(true);
    });

    it('should return true for discordapp.com webhook URLs', () => {
      expect(isDiscordWebhook('https://discordapp.com/api/webhooks/123/abc')).toBe(true);
    });

    it('should return false for discord:// Apprise URLs', () => {
      expect(isDiscordWebhook('discord://123/abc')).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(isDiscordWebhook(null)).toBe(false);
      expect(isDiscordWebhook(undefined)).toBe(false);
    });
  });

  describe('getRichFormattingServices', () => {
    it('should return array of service keys that support rich formatting', () => {
      const richServices = getRichFormattingServices();
      expect(richServices).toContain('discord');
      expect(richServices).toContain('slack');
      expect(richServices).toContain('telegram');
      expect(richServices).toContain('email');
      expect(richServices).not.toContain('ntfy');
      expect(richServices).not.toContain('pushover');
    });
  });

  describe('getAllServices', () => {
    it('should return all registered services', () => {
      const services = getAllServices();
      expect(Object.keys(services)).toContain('discord');
      expect(Object.keys(services)).toContain('slack');
      expect(Object.keys(services)).toContain('telegram');
      expect(Object.keys(services)).toContain('email');
      expect(Object.keys(services)).toContain('ntfy');
    });

    it('should have required properties on each service', () => {
      const services = getAllServices();
      for (const service of Object.values(services)) {
        expect(service).toHaveProperty('name');
        expect(service).toHaveProperty('patterns');
        expect(service).toHaveProperty('supportsRichFormatting');
        expect(service).toHaveProperty('formatter');
        expect(service).toHaveProperty('sendMethod');
        expect(Array.isArray(service.patterns)).toBe(true);
        expect(typeof service.name).toBe('string');
        expect(typeof service.supportsRichFormatting).toBe('boolean');
      }
    });
  });
});

