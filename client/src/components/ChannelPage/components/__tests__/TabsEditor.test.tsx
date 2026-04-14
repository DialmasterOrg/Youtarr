import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import TabsEditor from '../TabsEditor';
import { renderWithProviders } from '../../../../test-utils';

jest.mock('axios', () => ({
  post: jest.fn(),
  isAxiosError: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const axios = require('axios');

describe('TabsEditor', () => {
  const defaultProps = {
    channelId: 'UC123',
    token: 'test-token',
    detectedTabs: ['videos', 'shorts', 'streams'],
    hiddenTabs: [] as string[],
    onHiddenTabsChange: jest.fn(),
    onRefresh: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    axios.isAxiosError.mockReturnValue(false);
  });

  test('renders a checkbox for each detected tab and marks them checked', () => {
    renderWithProviders(<TabsEditor {...defaultProps} />);

    expect(screen.getByTestId('tabs-editor-checkbox-videos')).toBeChecked();
    expect(screen.getByTestId('tabs-editor-checkbox-shorts')).toBeChecked();
    expect(screen.getByTestId('tabs-editor-checkbox-streams')).toBeChecked();
  });

  test('reflects hidden tabs as unchecked', () => {
    renderWithProviders(<TabsEditor {...defaultProps} hiddenTabs={['shorts']} />);

    expect(screen.getByTestId('tabs-editor-checkbox-videos')).toBeChecked();
    expect(screen.getByTestId('tabs-editor-checkbox-shorts')).not.toBeChecked();
    expect(screen.getByTestId('tabs-editor-checkbox-streams')).toBeChecked();
  });

  test('calls onHiddenTabsChange when a checkbox is unchecked', async () => {
    const user = userEvent.setup();
    const onHiddenTabsChange = jest.fn();
    renderWithProviders(
      <TabsEditor {...defaultProps} onHiddenTabsChange={onHiddenTabsChange} />
    );

    await user.click(screen.getByTestId('tabs-editor-checkbox-shorts'));

    expect(onHiddenTabsChange).toHaveBeenCalledWith(['shorts']);
  });

  test('calls onHiddenTabsChange with remaining tabs when re-enabling a hidden tab', async () => {
    const user = userEvent.setup();
    const onHiddenTabsChange = jest.fn();
    renderWithProviders(
      <TabsEditor
        {...defaultProps}
        hiddenTabs={['shorts', 'streams']}
        onHiddenTabsChange={onHiddenTabsChange}
      />
    );

    await user.click(screen.getByTestId('tabs-editor-checkbox-streams'));

    expect(onHiddenTabsChange).toHaveBeenCalledWith(['shorts']);
  });

  test('shows all-hidden error when every tab is hidden', () => {
    renderWithProviders(
      <TabsEditor {...defaultProps} hiddenTabs={['videos', 'shorts', 'streams']} />
    );

    expect(screen.getByText('At least one tab must remain visible.')).toBeInTheDocument();
  });

  test('shows empty-state message when no tabs have been detected', () => {
    renderWithProviders(<TabsEditor {...defaultProps} detectedTabs={[]} />);

    expect(
      screen.getByText(/No tabs have been detected for this channel yet/)
    ).toBeInTheDocument();
    expect(screen.queryByTestId('tabs-editor-checkbox-videos')).not.toBeInTheDocument();
  });

  test('refresh button posts to /tabs/redetect and forwards result to onRefresh', async () => {
    const user = userEvent.setup();
    const onRefresh = jest.fn();
    axios.post.mockResolvedValueOnce({
      data: {
        availableTabs: ['videos', 'streams'],
        detectedTabs: ['videos', 'shorts', 'streams'],
        hiddenTabs: ['shorts'],
      },
    });

    renderWithProviders(
      <TabsEditor {...defaultProps} hiddenTabs={['shorts']} onRefresh={onRefresh} />
    );

    await user.click(screen.getByTestId('tabs-editor-refresh'));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        '/api/channels/UC123/tabs/redetect',
        null,
        { headers: { 'x-access-token': 'test-token' } }
      );
    });

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalledWith({
        availableTabs: ['videos', 'streams'],
        detectedTabs: ['videos', 'shorts', 'streams'],
        hiddenTabs: ['shorts'],
      });
    });
  });

  test('shows an error message when refresh fails', async () => {
    const user = userEvent.setup();
    axios.isAxiosError.mockReturnValue(true);
    axios.post.mockRejectedValueOnce({
      response: { status: 500, data: { error: 'yt-dlp exploded' } },
    });

    renderWithProviders(<TabsEditor {...defaultProps} />);

    await user.click(screen.getByTestId('tabs-editor-refresh'));

    await waitFor(() => {
      expect(screen.getByText('yt-dlp exploded')).toBeInTheDocument();
    });
  });

  test('disables checkboxes and refresh button while disabled prop is true', () => {
    renderWithProviders(<TabsEditor {...defaultProps} disabled />);

    expect(screen.getByTestId('tabs-editor-checkbox-videos')).toBeDisabled();
    expect(screen.getByTestId('tabs-editor-refresh')).toBeDisabled();
  });
});
