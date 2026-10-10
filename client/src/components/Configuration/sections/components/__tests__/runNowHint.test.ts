import { describeRunNowBlock } from '../runNowHint';
import { RunBlockReason, ScheduleRunAvailability } from '../../../hooks/useScheduleStatus';

const base = { settingsLabel: 'Watch status settings', featureOnInForm: false, timeZone: 'UTC' };

const blocked = (reason: RunBlockReason, extra: Partial<ScheduleRunAvailability> = {}): ScheduleRunAvailability => ({
  available: false, reason, message: `server says ${reason}`, availableAt: null, ...extra,
});

test('returns null when the task can run', () => {
  expect(describeRunNowBlock({ ...base, availability: { available: true, reason: null, message: null, availableAt: null } })).toBeNull();
});

test('running needs no hint because the status line says so', () => {
  expect(describeRunNowBlock({ ...base, availability: blocked('running') })).toBeNull();
});

test('turned off: points at the settings shown above', () => {
  expect(describeRunNowBlock({ ...base, availability: blocked('disabled') })?.text)
    .toBe('Available once this is turned on in Watch status settings.');
});

test('tells the user to save when the form has the feature on', () => {
  expect(describeRunNowBlock({ ...base, featureOnInForm: true, availability: blocked('disabled') })?.text)
    .toBe('Save your settings first: Run now uses the saved settings.');
});

test('cooldown says when it can run again, in server time', () => {
  const hint = describeRunNowBlock({ ...base, availability: blocked('cooldown', { availableAt: '2026-09-27T12:15:00.000Z' }) });
  expect(hint?.text).toMatch(/^Ran less than 15 minutes ago\. Available again at .*12:15/);
});

test('storage pause links to storage limits', () => {
  expect(describeRunNowBlock({ ...base, availability: blocked('downloads-paused') })).toEqual({
    text: 'server says downloads-paused', link: { to: '/settings/storage-limits', label: 'Storage limits' },
  });
});

test('no media server links to watch status settings', () => {
  expect(describeRunNowBlock({ ...base, availability: blocked('no-media-server') })?.link)
    .toEqual({ to: '/settings/watch-status', label: 'Watch status settings' });
});

test('YouTube throttle shows the server reason and when it ends', () => {
  const hint = describeRunNowBlock({ ...base, availability: blocked('youtube-throttled', { availableAt: '2026-09-27T18:00:00.000Z' }) });
  expect(hint?.text).toMatch(/^server says youtube-throttled Available again at /);
});

test('active download links to download activity', () => {
  expect(describeRunNowBlock({ ...base, availability: blocked('downloads-active') })?.link)
    .toEqual({ to: '/downloads/activity', label: 'Download activity' });
});
