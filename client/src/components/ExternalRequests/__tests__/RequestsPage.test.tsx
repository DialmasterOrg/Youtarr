import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import RequestsPage from '../RequestsPage';
import { ExternalRequestReview } from '../../../types/externalRequest';

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  isAxiosError: (error: unknown) => Boolean((error as { response?: unknown })?.response),
  isCancel: () => false,
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

const requestId = '9b89e5bc-8c90-4e72-b245-270fed2eacc2';
const pendingRequest = {
  id: requestId,
  type: 'video' as const,
  status: 'pending' as const,
  requester: {
    id: 4,
    name: 'External Client',
    keyPrefix: 'abcd1234',
    role: 'request',
    isActive: true,
    revokedAt: null,
  },
  target: {
    youtubeId: 'abcdefghijk',
    channelId: 8,
    youtubeChannelId: 'UC1234567890123456789012',
    channelTitle: 'Safe Channel',
    title: 'Safe video',
    mediaType: 'video',
    rating: 'TV-PG',
    contentRating: 'TV-Y',
  },
  job: null,
  createdAt: '2026-07-26T12:00:00.000Z',
  updatedAt: '2026-07-26T12:00:00.000Z',
};

const page = (data: ExternalRequestReview[] = [pendingRequest]) => ({
  data,
  pagination: { page: 1, pageSize: 25, total: data.length, totalPages: data.length ? 1 : 0 },
  filterOptions: { requesters: [pendingRequest.requester] },
});

const axiosResponse = <T,>(data: T) => ({ data });
const axiosError = (message: string) => Object.assign(new Error(message), {
  response: { data: { error: message } },
});

const renderPage = () => render(
  <MemoryRouter initialEntries={['/requests']}>
    <RequestsPage token="session-token" />
  </MemoryRouter>
);

describe('RequestsPage', () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
  });

  test('loads the queue, opens details, confirms approval, and refreshes status', async () => {
    const processing = {
      ...pendingRequest,
      status: 'processing' as const,
      job: {
        id: requestId,
        status: 'In Progress',
        type: 'External video request',
        createdAt: pendingRequest.createdAt,
        startedAt: pendingRequest.createdAt,
      },
    };
    mockedAxios.get
      .mockResolvedValueOnce(axiosResponse(page()))
      .mockResolvedValueOnce(axiosResponse(pendingRequest))
      .mockResolvedValueOnce(axiosResponse(page([processing])));
    mockedAxios.post.mockResolvedValueOnce(axiosResponse(processing));

    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Safe video')).toBeInTheDocument();
    expect(screen.getByText('External Client')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage API keys' }))
      .toHaveAttribute('href', '/settings/api-keys');
    expect(screen.getByRole('img', { name: 'Safe video thumbnail' }))
      .toHaveAttribute('src', 'https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg');
    await user.click(screen.getByRole('button', { name: 'Details' }));
    expect(await screen.findByText('Request details')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    await user.click(screen.getByRole('button', { name: 'Confirm approval' }));

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `/api/external-requests/${requestId}/approve`,
        {},
        expect.objectContaining({
          headers: {
            'x-access-token': 'session-token',
          },
        })
      );
    });
    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledTimes(3);
    });
    expect(mockedAxios.get).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/external-requests?'),
      expect.objectContaining({
        headers: { 'x-access-token': 'session-token' },
      })
    );
  });

  test('shows empty and retryable error states', async () => {
    mockedAxios.get
      .mockRejectedValueOnce(axiosError('Unable to read request queue'))
      .mockResolvedValueOnce(axiosResponse(page([])));

    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Unable to read request queue')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No requests match these filters.')).toBeInTheDocument();
  });

  test('requires a rejection reason before submission', async () => {
    mockedAxios.get
      .mockResolvedValueOnce(axiosResponse(page()))
      .mockResolvedValueOnce(axiosResponse(pendingRequest));

    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Details' }));
    await user.click(await screen.findByRole('button', { name: 'Reject' }));

    const confirm = screen.getByRole('button', { name: 'Confirm rejection' });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Not approved' } });
    expect(confirm).toBeEnabled();
  });

  test('reviews channel requests and sends the grant decision', async () => {
    const channelRequest: ExternalRequestReview = {
      ...pendingRequest,
      type: 'channel',
      target: {
        youtubeId: null,
        channelId: null,
        channelUrl: 'https://www.youtube.com/@safechannel',
        youtubeChannelId: null,
        channelTitle: null,
        title: null,
        mediaType: null,
        rating: null,
      },
    };
    const completed = {
      ...channelRequest,
      status: 'completed' as const,
      target: {
        ...channelRequest.target,
        channelId: 12,
        youtubeChannelId: 'UC1234567890123456789012',
        channelTitle: 'Safe Channel',
        rating: 'TV-PG',
      },
    };
    mockedAxios.get
      .mockResolvedValueOnce(axiosResponse(page([channelRequest])))
      .mockResolvedValueOnce(axiosResponse(channelRequest))
      .mockResolvedValueOnce(axiosResponse(page([completed])));
    mockedAxios.post.mockResolvedValueOnce(axiosResponse(completed));

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Details' }));
    expect(screen.getAllByText('@safechannel').length).toBeGreaterThan(0);
    expect(screen.queryByText('https://www.youtube.com/@safechannel')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open channel' }))
      .toHaveAttribute('href', 'https://www.youtube.com/@safechannel');
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    await user.click(screen.getByLabelText(
      'Grant the provisioned channel to the requesting key'
    ));
    await user.click(screen.getByRole('button', { name: 'Confirm approval' }));

    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalledWith(
      `/api/external-requests/${requestId}/approve`,
      { grantToRequestingKey: false },
      expect.objectContaining({
        headers: { 'x-access-token': 'session-token' },
      })
    ));
  });

  test('renders compact request metadata and starts approval from the review column', async () => {
    mockedAxios.get
      .mockResolvedValueOnce(axiosResponse(page()))
      .mockResolvedValueOnce(axiosResponse(page([{ ...pendingRequest, status: 'processing' }])));
    mockedAxios.post.mockResolvedValueOnce(axiosResponse({ ...pendingRequest, status: 'processing' }));

    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Safe video');
    const requestCell = screen.getByTestId(`request-summary-${requestId}`);
    const cell = within(requestCell);
    expect(cell.getByText('Downloaded')).toBeInTheDocument();
    expect(cell.getAllByText('TV-Y').length).toBeGreaterThan(0);
    expect(cell.getAllByText('Safe Channel').length).toBeGreaterThan(0);

    expect(screen.getByRole('button', { name: 'Details' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Approve request' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Reject request' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Approve request' }));
    expect(screen.getByRole('button', { name: 'Confirm approval' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm approval' }));

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `/api/external-requests/${requestId}/approve`,
        {},
        expect.objectContaining({ headers: { 'x-access-token': 'session-token' } })
      );
    });
  });

  test('keeps review controls aligned but disables decisions for a completed request', async () => {
    const completed = { ...pendingRequest, status: 'completed' as const };
    mockedAxios.get.mockResolvedValueOnce(axiosResponse(page([completed])));

    renderPage();

    expect(await screen.findByRole('button', { name: 'Details' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Approve request' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reject request' })).toBeDisabled();
  });

  test('ignores an obsolete details response after starting an inline action', async () => {
    const other = {
      ...pendingRequest,
      id: '8b89e5bc-8c90-4e72-b245-270fed2eacc2',
      target: { ...pendingRequest.target, title: 'Other video' },
    };
    let resolveDetails!: (response: { data: ExternalRequestReview }) => void;
    const deferredDetails = new Promise<{ data: ExternalRequestReview }>((resolve) => {
      resolveDetails = resolve;
    });
    mockedAxios.get
      .mockResolvedValueOnce(axiosResponse(page([pendingRequest, other])))
      .mockImplementationOnce(() => deferredDetails);
    mockedAxios.post.mockResolvedValueOnce(axiosResponse({ ...other, status: 'approved' }));

    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Other video');
    await user.click(within(screen.getByTestId(`request-card-${requestId}`)).getByRole('button', { name: 'Details' }));
    await user.click(within(screen.getByRole('dialog')).getByText('Close', { selector: 'button' }));
    await user.click(within(screen.getByTestId(`request-card-${other.id}`)).getByRole('button', { name: 'Approve request' }));
    resolveDetails(axiosResponse(pendingRequest));
    await user.click(screen.getByRole('button', { name: 'Confirm approval' }));

    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalledWith(
      `/api/external-requests/${other.id}/approve`, {}, expect.anything()
    ));
  });
});
