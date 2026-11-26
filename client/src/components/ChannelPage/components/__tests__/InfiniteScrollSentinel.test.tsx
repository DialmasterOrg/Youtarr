import React, { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import InfiniteScrollSentinel from '../InfiniteScrollSentinel';

describe('InfiniteScrollSentinel', () => {
  const onRetry = jest.fn();
  const showSentinel = (props: { loadingMore?: boolean; caughtUp?: boolean; loadFailed?: boolean } = {}) => {
    const sentinelRef = createRef<HTMLDivElement>();
    render(
      <InfiniteScrollSentinel
        sentinelRef={sentinelRef}
        loadingMore={props.loadingMore ?? false}
        caughtUp={props.caughtUp ?? false}
        loadFailed={props.loadFailed ?? false}
        onRetry={onRetry}
      />
    );
    return sentinelRef;
  };

  beforeEach(() => {
    onRetry.mockClear();
  });

  test('attaches the given ref to an element on the page', () => {
    const sentinelRef = showSentinel();

    expect(sentinelRef.current).toBeInTheDocument();
  });

  test('shows nothing else between pages', () => {
    showSentinel();

    expect(screen.queryByLabelText('Loading more videos')).not.toBeInTheDocument();
    expect(screen.queryByText("You're all caught up.")).not.toBeInTheDocument();
  });

  test('shows a loading indicator while the next page loads', () => {
    showSentinel({ loadingMore: true });

    expect(screen.getByLabelText('Loading more videos')).toBeInTheDocument();
  });

  test('says so when every page is loaded', () => {
    showSentinel({ caughtUp: true });

    expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
  });

  test('offers a retry when a load failed', async () => {
    showSentinel({ loadFailed: true });

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(screen.getByText('Could not load videos.')).toBeInTheDocument();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('offers no retry when nothing failed', () => {
    showSentinel();

    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });
});
