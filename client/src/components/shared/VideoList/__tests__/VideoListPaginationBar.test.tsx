import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import VideoListPaginationBar from '../VideoListPaginationBar';
import { renderWithProviders } from '../../../../test-utils';

function defaultProps() {
  return {
    placement: 'bottom' as const,
    hasContent: true,
    useInfiniteScroll: false,
    page: 2,
    totalPages: 5,
    onPageChange: jest.fn(),
    pageSize: 16 as const,
    onPageSizeChange: jest.fn(),
    isMobile: false,
  };
}

describe('VideoListPaginationBar', () => {
  test('renders nothing when hasContent is false', () => {
    renderWithProviders(
      <VideoListPaginationBar {...defaultProps()} hasContent={false} />
    );
    expect(screen.queryByTestId('video-list-pagination-bar-bottom')).not.toBeInTheDocument();
  });

  test('renders page controls when there is more than one page and not in infinite mode', () => {
    renderWithProviders(<VideoListPaginationBar {...defaultProps()} />);
    expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument();
  });

  test('renders nothing in infinite scroll mode', () => {
    renderWithProviders(
      <VideoListPaginationBar {...defaultProps()} useInfiniteScroll />
    );
    expect(screen.queryByTestId('video-list-pagination-bar-bottom')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Per page:')).not.toBeInTheDocument();
  });

  test('hides page controls when only one page exists but still shows the selector', () => {
    renderWithProviders(
      <VideoListPaginationBar {...defaultProps()} page={1} totalPages={1} />
    );
    expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '16' })).toBeInTheDocument();
  });

  test('hides the "Per page:" label on mobile but keeps the selector', () => {
    renderWithProviders(<VideoListPaginationBar {...defaultProps()} isMobile />);
    expect(screen.queryByText('Per page:')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '16' })).toBeInTheDocument();
  });

  test('applies top border when placement is top', () => {
    renderWithProviders(<VideoListPaginationBar {...defaultProps()} placement="top" />);
    const bar = screen.getByTestId('video-list-pagination-bar-top');
    expect(bar).toHaveStyle({ borderBottom: '1px solid var(--border)' });
  });

  test('applies bottom border when placement is bottom', () => {
    renderWithProviders(<VideoListPaginationBar {...defaultProps()} placement="bottom" />);
    const bar = screen.getByTestId('video-list-pagination-bar-bottom');
    expect(bar).toHaveStyle({ borderTop: '1px solid var(--border)' });
  });

  test('fires onPageChange when a page button is clicked', async () => {
    const user = userEvent.setup();
    const onPageChange = jest.fn();
    renderWithProviders(
      <VideoListPaginationBar {...defaultProps()} onPageChange={onPageChange} />
    );
    await user.click(screen.getByRole('button', { name: /go to page 3/i }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  test('reflects the current pageSize value in the selector', () => {
    renderWithProviders(<VideoListPaginationBar {...defaultProps()} pageSize={32} />);
    expect(screen.getByRole('button', { name: '32' })).toBeInTheDocument();
  });
});
