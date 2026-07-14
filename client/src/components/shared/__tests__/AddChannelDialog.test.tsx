import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AddChannelDialog from '../AddChannelDialog';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const baseProps = {
  open: true,
  onClose: jest.fn(),
  channelName: 'Alpha Channel',
  channelUrl: 'https://www.youtube.com/channel/UCa',
};

function renderDialog(props = {}) {
  return render(
    <MemoryRouter>
      <AddChannelDialog {...baseProps} {...props} />
    </MemoryRouter>
  );
}

describe('AddChannelDialog', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('renders the channel name in the confirmation copy', () => {
    renderDialog();
    expect(screen.getByText(/add "alpha channel" to your channels\?/i)).toBeInTheDocument();
  });

  test('renders nothing when closed', () => {
    renderDialog({ open: false });
    expect(screen.queryByText(/add "alpha channel"/i)).not.toBeInTheDocument();
  });

  test('confirm closes the dialog and navigates with addChannelUrl state', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /add channel/i }));

    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/subscriptions', {
      state: { addChannelUrl: 'https://www.youtube.com/channel/UCa' },
    });
  });

  test('cancel closes without navigating', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
