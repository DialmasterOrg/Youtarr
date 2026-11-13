import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import NewVideosNotice from '../NewVideosNotice';
import { renderWithProviders } from '../../../../test-utils';

const renderNotice = (props: Partial<React.ComponentProps<typeof NewVideosNotice>> = {}) =>
  renderWithProviders(
    <NewVideosNotice checking={false} newCount={0} onShow={jest.fn()} onDismiss={jest.fn()} {...props} />
  );

test('renders nothing when idle', () => {
  renderNotice();

  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Show' })).not.toBeInTheDocument();
});

test('shows the checking status', () => {
  renderNotice({ checking: true });

  expect(screen.getByRole('status')).toHaveTextContent('Checking for new videos');
});

test('says "1 new video" for one', () => {
  renderNotice({ newCount: 1 });

  expect(screen.getByText('1 new video')).toBeInTheDocument();
});

test('says "3 new videos" for three', () => {
  renderNotice({ newCount: 3 });

  expect(screen.getByText('3 new videos')).toBeInTheDocument();
});

test('calls onShow when Show is clicked', async () => {
  const onShow = jest.fn();
  renderNotice({ newCount: 3, onShow });

  await userEvent.click(screen.getByRole('button', { name: 'Show' }));

  expect(onShow).toHaveBeenCalledTimes(1);
});

test('calls onDismiss when Dismiss is clicked', async () => {
  const onDismiss = jest.fn();
  const onShow = jest.fn();
  renderNotice({ newCount: 3, onShow, onDismiss });

  await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

  expect(onDismiss).toHaveBeenCalledTimes(1);
  expect(onShow).not.toHaveBeenCalled();
});

test('shows the bar rather than the status when both apply', () => {
  renderNotice({ checking: true, newCount: 2 });

  expect(screen.getByText('2 new videos')).toBeInTheDocument();
  expect(screen.queryByText('Checking for new videos')).not.toBeInTheDocument();
});

test('offers no Dismiss while only checking', () => {
  renderNotice({ checking: true });

  expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
});
