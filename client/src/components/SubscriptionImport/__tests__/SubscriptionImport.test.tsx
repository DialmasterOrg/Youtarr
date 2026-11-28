import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ImportSubscriptionsPage from '../index';
import { renderWithProviders } from '../../../test-utils';
import { DEFAULT_ROW_SETTINGS } from '../../../types/subscriptionImport';
import { ImportFlowState } from '../hooks/useImportFlow';

jest.mock('axios', () => {
  const post = jest.fn();
  class AxiosError extends Error {
    response?: { data?: { error?: string } };
    constructor(message: string, response?: AxiosError['response']) {
      super(message);
      this.name = 'AxiosError';
      this.response = response;
    }
  }
  return {
    __esModule: true,
    default: { post },
    post,
    AxiosError,
  };
});

const axios = require('axios');
const { AxiosError } = axios;

const mockDispatch = jest.fn();
let mockState: ImportFlowState;

jest.mock('../hooks/useImportFlow', () => ({
  useImportFlow: () => ({ state: mockState, dispatch: mockDispatch }),
}));

jest.mock('../hooks/usePreviewUpload', () => ({
  usePreviewUpload: () => ({ loading: false, error: null, upload: jest.fn() }),
}));

jest.mock('../hooks/useImportJob', () => ({
  useImportJob: () => ({ jobDetail: null }),
}));

jest.mock('../../../hooks/useSubfolders', () => ({
  useSubfolders: () => ({ subfolders: [], createSubfolder: jest.fn() }),
}));

jest.mock('../../../hooks/useConfig', () => ({
  useConfig: () => ({ config: {} }),
}));

jest.mock('../components/ReviewTable', () => ({
  __esModule: true,
  default: function MockReviewTable() {
    return null;
  },
}));

jest.mock('../components/RecentImportsSection', () => ({
  __esModule: true,
  default: function MockRecentImportsSection() {
    return null;
  },
}));

const reviewingState = (): ImportFlowState => ({
  phase: 'reviewing',
  source: 'takeout',
  channels: [
    {
      channelId: 'ch1',
      title: 'Channel One',
      url: 'https://youtube.com/channel/ch1',
      thumbnailUrl: null,
      alreadySubscribed: false,
    },
  ],
  rowStates: { ch1: { selected: true, settings: { ...DEFAULT_ROW_SETTINGS } } },
  activeJobId: null,
  error: null,
});

const startImport = async () => {
  renderWithProviders(<ImportSubscriptionsPage token="test-token" />);
  await userEvent.click(screen.getByRole('button', { name: 'Import selected (1)' }));
};

describe('ImportSubscriptionsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState = reviewingState();
  });

  test('starts the import with the selected channels', async () => {
    axios.post.mockResolvedValueOnce({ data: { jobId: 'job-1' } });

    await startImport();

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'START_IMPORT', payload: 'job-1' });
    });
    expect(axios.post).toHaveBeenCalledWith(
      '/api/subscriptions/imports',
      {
        channels: [
          {
            channelId: 'ch1',
            url: 'https://youtube.com/channel/ch1',
            title: 'Channel One',
            settings: DEFAULT_ROW_SETTINGS,
          },
        ],
      },
      { headers: { 'x-access-token': 'test-token' } }
    );
  });

  test("reports the server's explanation when the import is refused", async () => {
    axios.post.mockRejectedValueOnce(
      new AxiosError('Request failed with status code 409', { data: { error: 'An import is already running' } })
    );

    await startImport();

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'PREVIEW_ERROR', payload: 'An import is already running' });
    });
  });

  test('reports a plain failure, not the transport message, when the server sent no error text', async () => {
    axios.post.mockRejectedValueOnce(new AxiosError('Request failed with status code 502', { data: {} }));

    await startImport();

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'PREVIEW_ERROR', payload: 'Failed to start import' });
    });
  });
});
