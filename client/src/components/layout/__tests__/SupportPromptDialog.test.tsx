import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import SupportPromptDialog, {
  PREVIEW_QUERY_PARAM,
  PREVIEW_QUERY_VALUE,
} from '../SupportPromptDialog';
import { GITHUB_SPONSORS_URL, PATREON_URL } from '../../shared/SupportLinkButtons';

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

const AUTH_HEADERS = { headers: { 'x-access-token': 'test-token' } };
const DIALOG_NAME = /enjoying youtarr/i;

function renderDialog(token: string | null = 'test-token') {
  return render(
    <MemoryRouter>
      <SupportPromptDialog token={token} />
    </MemoryRouter>
  );
}

describe('SupportPromptDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.pushState({}, '', '/');
    mockedAxios.get.mockResolvedValue({ data: { show: false } });
    mockedAxios.post.mockResolvedValue({ status: 204 });
  });

  test('stays hidden when the server says not to show it', async () => {
    renderDialog();

    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalledWith('/api/support-prompt', AUTH_HEADERS));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  test('does not ask the server without a token', () => {
    renderDialog(null);

    expect(mockedAxios.get).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('shows the prompt with both donation links when the server says to', async () => {
    mockedAxios.get.mockResolvedValue({ data: { show: true } });
    renderDialog();

    expect(await screen.findByRole('dialog', { name: DIALOG_NAME })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /github sponsors/i })).toHaveAttribute('href', GITHUB_SPONSORS_URL);
    expect(screen.getByRole('link', { name: /patreon/i })).toHaveAttribute('href', PATREON_URL);
    expect(screen.getByText(/only time youtarr will ask/i)).toBeInTheDocument();
  });

  test('records the prompt as shown as soon as it is displayed', async () => {
    mockedAxios.get.mockResolvedValue({ data: { show: true } });
    renderDialog();

    await screen.findByRole('dialog', { name: DIALOG_NAME });
    await waitFor(() =>
      expect(mockedAxios.post).toHaveBeenCalledWith('/api/support-prompt/shown', null, AUTH_HEADERS)
    );
  });

  test('closes on "No thanks"', async () => {
    mockedAxios.get.mockResolvedValue({ data: { show: true } });
    const user = userEvent.setup();
    renderDialog();
    await screen.findByRole('dialog', { name: DIALOG_NAME });

    await user.click(screen.getByRole('button', { name: /no thanks/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  test('closes on the close button', async () => {
    mockedAxios.get.mockResolvedValue({ data: { show: true } });
    const user = userEvent.setup();
    renderDialog();
    await screen.findByRole('dialog', { name: DIALOG_NAME });

    await user.click(screen.getByRole('button', { name: /close/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  test('closes after a donation link is clicked', async () => {
    mockedAxios.get.mockResolvedValue({ data: { show: true } });
    const user = userEvent.setup();
    renderDialog();
    await screen.findByRole('dialog', { name: DIALOG_NAME });

    await user.click(screen.getByRole('link', { name: /patreon/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  test('links to the About page', async () => {
    mockedAxios.get.mockResolvedValue({ data: { show: true } });
    renderDialog();
    await screen.findByRole('dialog', { name: DIALOG_NAME });

    expect(screen.getByRole('link', { name: /settings > about/i })).toHaveAttribute('href', '/settings/about');
  });

  test('stays hidden when the eligibility check fails', async () => {
    mockedAxios.get.mockRejectedValue(new Error('network down'));
    renderDialog();

    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('stays open when recording the display fails', async () => {
    mockedAxios.get.mockResolvedValue({ data: { show: true } });
    mockedAxios.post.mockRejectedValue(new Error('save failed'));
    renderDialog();

    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalled());
    expect(screen.getByRole('dialog', { name: DIALOG_NAME })).toBeInTheDocument();
  });

  test('preview mode shows the prompt without contacting the server', async () => {
    window.history.pushState({}, '', `/?${PREVIEW_QUERY_PARAM}=${PREVIEW_QUERY_VALUE}`);
    renderDialog();

    expect(await screen.findByRole('dialog', { name: DIALOG_NAME })).toBeInTheDocument();
    expect(mockedAxios.get).not.toHaveBeenCalled();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });
});
