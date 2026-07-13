import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('axios', () => ({
  post: jest.fn(),
  isCancel: (err: unknown) => Boolean(err && (err as { name?: string }).name === 'CanceledError'),
  CanceledError: class CanceledError extends Error {
    constructor() { super('canceled'); this.name = 'CanceledError'; }
  },
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const axios = require('axios');
const FindChannels = require('../index').default;

const apiResult = (overrides = {}) => ({
  channelId: 'UCa',
  name: 'Alpha',
  handle: '@alpha',
  url: 'https://www.youtube.com/channel/UCa',
  thumbnailUrl: null,
  subscriberCount: 1000,
  videoCount: 10,
  description: null,
  subscribed: false,
  ...overrides,
});

function renderPage() {
  return render(
    <MemoryRouter>
      <FindChannels token="t" />
    </MemoryRouter>
  );
}

describe('FindChannels page', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('submitting a search renders channel cards', async () => {
    axios.post.mockResolvedValueOnce({ data: { results: [apiResult()] } });

    renderPage();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'alpha' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledWith(
      '/api/channels/search',
      { query: 'alpha', count: 25 },
      expect.anything()
    );
  });

  test('clicking an unsubscribed result opens the confirm dialog; confirming navigates with addChannelUrl state', async () => {
    axios.post.mockResolvedValueOnce({ data: { results: [apiResult()] } });

    renderPage();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'alpha' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /add alpha/i }));

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByText(/add "alpha" to your channels\?/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /add channel/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/subscriptions', {
      state: { addChannelUrl: 'https://www.youtube.com/channel/UCa' },
    });
  });

  test('canceling the confirm dialog stays on the results without navigating', async () => {
    axios.post.mockResolvedValueOnce({ data: { results: [apiResult()] } });

    renderPage();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'alpha' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /add alpha/i }));

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.queryByText(/add "alpha" to your channels\?/i)).not.toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  test('clicking a subscribed result navigates to its channel page', async () => {
    axios.post.mockResolvedValueOnce({
      data: { results: [apiResult({ subscribed: true })] },
    });

    renderPage();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'alpha' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /view alpha/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/channel/UCa');
  });

  test('shows the server error and retries the last query', async () => {
    axios.post
      .mockRejectedValueOnce({ response: { data: { error: 'Search timed out' } } })
      .mockResolvedValueOnce({ data: { results: [apiResult()] } });

    renderPage();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'alpha' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    expect(await screen.findByText('Search timed out')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(axios.post).toHaveBeenLastCalledWith(
      '/api/channels/search',
      { query: 'alpha', count: 25 },
      expect.anything()
    );
  });
});
