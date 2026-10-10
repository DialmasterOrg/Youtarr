import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { ScheduledTaskIndicator } from '../ScheduledTaskIndicator';
import { TooltipProvider } from '../../ui/tooltip';
import { useRunningScheduledTasks } from '../../../hooks/useRunningScheduledTasks';

jest.mock('../../../hooks/useRunningScheduledTasks', () => ({
  useRunningScheduledTasks: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const mockUseRunningScheduledTasks = useRunningScheduledTasks as jest.Mock;
const rescan = { key: 'videoRescanFrequency', label: 'Rescan files on disk' };
const sync = { key: 'watchStatusSyncFrequency', label: 'Watch status sync' };

function renderIndicator(token: string | null = 'test-token') {
  return render(
    <MemoryRouter>
      <TooltipProvider>
        <ScheduledTaskIndicator token={token} />
      </TooltipProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('renders nothing when no scheduled task is running', () => {
  mockUseRunningScheduledTasks.mockReturnValue({ running: [] });
  renderIndicator();
  expect(screen.queryByRole('button', { name: /scheduled task/i })).not.toBeInTheDocument();
});

test('names the running task', () => {
  mockUseRunningScheduledTasks.mockReturnValue({ running: [rescan] });
  renderIndicator();
  expect(screen.getByRole('button', { name: 'Scheduled task running: Rescan files on disk' })).toBeInTheDocument();
});

test('names every running task when several run at once', () => {
  mockUseRunningScheduledTasks.mockReturnValue({ running: [rescan, sync] });
  renderIndicator();
  expect(screen.getByRole('button', {
    name: 'Scheduled tasks running: Rescan files on disk, Watch status sync',
  })).toBeInTheDocument();
});

test('passes the token through to the hook', () => {
  mockUseRunningScheduledTasks.mockReturnValue({ running: [] });
  renderIndicator('abc-123');
  expect(mockUseRunningScheduledTasks).toHaveBeenCalledWith('abc-123');
});

test('opens the Scheduling settings when clicked', async () => {
  mockUseRunningScheduledTasks.mockReturnValue({ running: [rescan] });
  const user = userEvent.setup();
  renderIndicator();
  await user.click(screen.getByRole('button', { name: /Scheduled task running/ }));
  expect(mockNavigate).toHaveBeenCalledWith('/settings/scheduling');
});

test('stops pulsing for users who prefer reduced motion', () => {
  mockUseRunningScheduledTasks.mockReturnValue({ running: [rescan] });
  renderIndicator();
  expect(screen.getByTestId('scheduled-task-pulse')).toHaveClass('animate-ping-slow', 'motion-reduce:animate-none');
});
