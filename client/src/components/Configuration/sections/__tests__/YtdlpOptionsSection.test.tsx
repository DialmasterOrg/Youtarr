import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

jest.mock('axios', () => ({ post: jest.fn() }));

const axios = require('axios');

import { YtdlpOptionsSection } from '../YtdlpOptionsSection';
import { renderWithProviders } from '../../../../test-utils';
import { DEFAULT_CONFIG } from '../../../../config/configSchema';
import { ConfigState, CustomArgsCheck } from '../../types';

const createConfig = (overrides: Partial<ConfigState> = {}): ConfigState => ({
  ...DEFAULT_CONFIG,
  ...overrides,
});

interface SetupOpts {
  initialConfig?: Partial<ConfigState>;
  token?: string | null;
  savedCustomArgsCheck?: CustomArgsCheck | null;
}

const setup = ({ initialConfig = {}, token = 'tok', savedCustomArgsCheck = null }: SetupOpts = {}) => {
  const user = userEvent.setup();
  const onConfigChange = jest.fn();

  const Controlled: React.FC = () => {
    const [config, setConfig] = React.useState(createConfig(initialConfig));
    const handleConfigChange = (updates: Partial<ConfigState>) => {
      setConfig((prev) => ({ ...prev, ...updates }));
      onConfigChange(updates);
    };
    return (
      <YtdlpOptionsSection
        config={config}
        onConfigChange={handleConfigChange}
        onMobileTooltipClick={jest.fn()}
        token={token}
        savedCustomArgsCheck={savedCustomArgsCheck}
      />
    );
  };

  renderWithProviders(<Controlled />);
  return { user, onConfigChange };
};

describe('YtdlpOptionsSection', () => {
  beforeEach(() => jest.clearAllMocks());

  test('renders all five inputs and the Validate button', () => {
    setup();
    expect(screen.getByLabelText(/sleep between requests/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/proxy url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ip family/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/download rate limit/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/custom yt-dlp arguments/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /validate arguments/i })).toBeInTheDocument();
  });

  test('IP Family default is "Force IPv4" with helper text recommending IPv4', () => {
    setup();
    expect(screen.getByText(/force ipv4/i)).toBeInTheDocument();
    expect(screen.getByText(/ipv4 is recommended/i)).toBeInTheDocument();
  });

  test('typing a flag no longer shows an inline block error (the server decides)', async () => {
    const { user } = setup();
    const textarea = screen.getByLabelText(/custom yt-dlp arguments/i);
    await user.type(textarea, '--exec foo');
    expect(screen.queryByText(/not allowed/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /validate arguments/i })).not.toBeDisabled();
  });

  test('renders a blocked notice for saved args the server rejected', () => {
    setup({
      initialConfig: { ytdlpCustomArgs: '--no-mtime --exec rm' },
      savedCustomArgsCheck: {
        blocked: [{ given: '--exec', option: '--exec', reason: 'can run programs or load code on the server' }],
        warnings: [],
        errors: [],
      },
    });
    expect(screen.getByText(/not allowed and are being skipped/i)).toBeInTheDocument();
    expect(screen.getByText(/can run programs or load code/i)).toBeInTheDocument();
    expect(screen.getByText(/rest of your options still apply/i)).toBeInTheDocument();
  });

  test('renders a notice for saved args that could not be read', () => {
    setup({
      initialConfig: { ytdlpCustomArgs: '--no-mtime --format' },
      savedCustomArgsCheck: {
        blocked: [],
        warnings: [],
        errors: ['--format needs a value but none was given.'],
      },
    });
    expect(screen.getByText(/could not be read and are being skipped/i)).toBeInTheDocument();
    expect(screen.getByText(/--format needs a value/i)).toBeInTheDocument();
  });

  test('renders a warning notice for saved args that may break downloads', () => {
    setup({
      initialConfig: { ytdlpCustomArgs: '--extract-audio' },
      savedCustomArgsCheck: {
        blocked: [],
        warnings: [{ given: '--extract-audio', option: '--extract-audio', reason: 'this turns every video download into an audio-only file' }],
        errors: [],
      },
    });
    expect(screen.getByText(/may cause problems/i)).toBeInTheDocument();
    expect(screen.getByText(/audio-only file/i)).toBeInTheDocument();
  });

  test('Validate shows a blocked alert when the server returns 400 with customArgsCheck', async () => {
    axios.post.mockRejectedValueOnce({
      response: {
        status: 400,
        data: {
          error: 'Custom yt-dlp options are not valid: --exec (can run programs or load code on the server)',
          customArgsCheck: {
            blocked: [{ given: '--exec', option: '--exec', reason: 'can run programs or load code on the server' }],
            warnings: [],
            errors: [],
          },
        },
      },
    });
    const { user } = setup({ initialConfig: { ytdlpCustomArgs: '--exec rm' } });
    await user.click(screen.getByRole('button', { name: /validate arguments/i }));
    expect(await screen.findByText(/these options are not allowed/i)).toBeInTheDocument();
    expect(screen.getByText(/can run programs or load code/i)).toBeInTheDocument();
  });

  test('Validate shows both blocked options and parse errors when the server returns both', async () => {
    axios.post.mockRejectedValueOnce({
      response: {
        status: 400,
        data: {
          error: 'Custom yt-dlp options are not valid: "stray" looks like a positional argument. Not allowed: --exec (can run programs).',
          customArgsCheck: {
            blocked: [{ given: '--exec', option: '--exec', reason: 'can run programs or load code on the server' }],
            warnings: [],
            errors: ['"stray" looks like a positional argument.'],
          },
        },
      },
    });
    const { user } = setup({ initialConfig: { ytdlpCustomArgs: '--exec rm' } });
    await user.click(screen.getByRole('button', { name: /validate arguments/i }));
    expect(await screen.findByText(/these options could not be read/i)).toBeInTheDocument();
    expect(screen.getByText('"stray" looks like a positional argument.')).toBeInTheDocument();
    expect(screen.getByText(/these options are not allowed/i)).toBeInTheDocument();
    expect(screen.queryByText(/yt-dlp rejected the arguments/i)).not.toBeInTheDocument();
  });

  test('Validate shows a warning alert when the server accepts but flags a risky option', async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        ok: true,
        message: 'Arguments parsed successfully',
        warnings: [{ given: '--extract-audio', option: '--extract-audio', reason: 'this turns every video download into an audio-only file' }],
      },
    });
    const { user } = setup({ initialConfig: { ytdlpCustomArgs: '--extract-audio' } });
    await user.click(screen.getByRole('button', { name: /validate arguments/i }));
    expect(await screen.findByText(/may cause problems/i)).toBeInTheDocument();
    expect(screen.getByText(/audio-only file/i)).toBeInTheDocument();
  });

  test('typing a positional token in custom args shows inline error and disables validation', async () => {
    const { user } = setup();
    const textarea = screen.getByLabelText(/custom yt-dlp arguments/i);
    await user.type(textarea, '5M');

    expect(await screen.findByText(/looks like a positional argument/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /validate arguments/i })).toBeDisabled();
  });

  test('custom args over the character limit show inline error and disable validation', () => {
    setup({ initialConfig: { ytdlpCustomArgs: '--no-mtime '.repeat(201) } });

    expect(screen.getByText(/exceed the 2000-character limit/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /validate arguments/i })).toBeDisabled();
  });

  test('quoted multi-word custom arg values do not trigger positional inline error', () => {
    setup({ initialConfig: { ytdlpCustomArgs: '--user-agent "Mozilla 5.0"' } });

    expect(screen.queryByText(/looks like a positional argument/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /validate arguments/i })).not.toBeDisabled();
  });

  test('rate-limit input shows inline error on bad format (5MB)', async () => {
    const { user } = setup();
    const input = screen.getByLabelText(/download rate limit/i);
    await user.type(input, '5MB');
    await user.tab();
    expect(await screen.findByText(/invalid rate format/i)).toBeInTheDocument();
  });

  test.each(['5M', '500K', '1.5M'])('rate-limit input accepts %s without error', async (value) => {
    const { user } = setup();
    const input = screen.getByLabelText(/download rate limit/i);
    await user.type(input, value);
    await user.tab();
    expect(screen.queryByText(/invalid rate format/i)).not.toBeInTheDocument();
  });

  test('Validate button is disabled when textarea is empty', () => {
    setup();
    const button = screen.getByRole('button', { name: /validate arguments/i });
    expect(button).toBeDisabled();
  });

  test('Validate button click triggers POST and shows green success', async () => {
    axios.post.mockResolvedValueOnce({
      data: { ok: true, message: 'Arguments parsed successfully' },
    });

    const { user } = setup({ initialConfig: { ytdlpCustomArgs: '--no-mtime' } });
    await user.click(screen.getByRole('button', { name: /validate arguments/i }));

    await waitFor(() => {
      expect(screen.getByText(/arguments parsed successfully/i)).toBeInTheDocument();
    });
    expect(axios.post).toHaveBeenCalledWith(
      '/api/ytdlp/validate-args',
      { args: '--no-mtime' },
      { headers: { 'x-access-token': 'tok' } }
    );
  });

  test('Validate button click shows yt-dlp stderr in error alert on failure', async () => {
    axios.post.mockResolvedValueOnce({
      data: { ok: false, stderr: 'yt-dlp: error: no such option: --bogus' },
    });

    const { user } = setup({ initialConfig: { ytdlpCustomArgs: '--bogus' } });
    await user.click(screen.getByRole('button', { name: /validate arguments/i }));

    expect(await screen.findByText(/no such option: --bogus/i)).toBeInTheDocument();
  });

  test('always shows the power-user warning Alert above the textarea', () => {
    setup();
    expect(screen.getByText(/power user feature/i)).toBeInTheDocument();
    expect(screen.getByText(/applied to every yt-dlp call/i)).toBeInTheDocument();
  });

  test('selecting Force IPv6 calls onConfigChange with ytdlpIpFamily=ipv6', async () => {
    const { user, onConfigChange } = setup();
    const select = screen.getByLabelText(/ip family/i);
    await user.click(select);
    const ipv6Option = within(screen.getByRole('listbox')).getByText(/force ipv6/i);
    await user.click(ipv6Option);
    expect(onConfigChange).toHaveBeenCalledWith({ ytdlpIpFamily: 'ipv6' });
  });
});
