import React from 'react';
import { MenuItem, Select, Typography } from '../../ui';
import PageControls from '../PageControls';
import { ALLOWED_PAGE_SIZES, isPageSize, type PageSize } from './pageSizes';

export interface VideoListPaginationBarProps {
  placement: 'top' | 'bottom';
  hasContent: boolean;
  useInfiniteScroll: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: PageSize;
  onPageSizeChange: (size: PageSize) => void;
  isMobile: boolean;
  allowedPageSizes?: readonly number[];
}

function VideoListPaginationBar({
  placement,
  hasContent,
  useInfiniteScroll,
  page,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  isMobile,
  allowedPageSizes = ALLOWED_PAGE_SIZES,
}: VideoListPaginationBarProps) {
  if (!hasContent) return null;

  const borderStyle =
    placement === 'top'
      ? { borderBottom: '1px solid var(--border)' }
      : { borderTop: '1px solid var(--border)' };

  const showPageControls = !useInfiniteScroll && totalPages > 1;

  return (
    <div
      data-testid={`video-list-pagination-bar-${placement}`}
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
        padding: '12px 16px',
        ...borderStyle,
        position: 'relative',
        minHeight: 48,
      }}
    >
      {showPageControls && (
        <PageControls
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
          compact={isMobile}
        />
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          position: isMobile ? undefined : 'absolute',
          right: isMobile ? undefined : 16,
        }}
      >
        {!isMobile && (
          <Typography variant="body2" style={{ color: 'var(--muted-foreground)' }}>
            Per page:
          </Typography>
        )}
        <Select
          size="small"
          value={pageSize}
          onChange={(e) => {
            const val = Number(e.target.value);
            if (isPageSize(val)) {
              onPageSizeChange(val);
            }
          }}
          aria-label="videos per page"
          className="min-w-[64px]"
        >
          {allowedPageSizes.map((size) => (
            <MenuItem key={size} value={size}>
              {size}
            </MenuItem>
          ))}
        </Select>
      </div>
    </div>
  );
}

export default VideoListPaginationBar;
