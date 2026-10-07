import React from 'react';
import {
  Typography,
  CircularProgress,
  Skeleton,
  Card,
  CardContent,
} from '../../ui';

interface ConfigurationSkeletonProps {
  compact?: boolean;
}

function ConfigurationSkeleton({ compact = false }: ConfigurationSkeletonProps) {
  return (
    <div style={{ padding: compact ? 0 : 24 }}>
      {!compact && (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
          <CircularProgress size={20} style={{ marginRight: 16 }} />
          <Typography variant="h6">Loading configuration...</Typography>
        </div>
      )}

      {compact && (
        <span
          aria-live="polite"
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            whiteSpace: 'nowrap',
          }}
        >
          Loading configuration...
        </span>
      )}

      {/* Loading skeleton for Core: the Library folders card, then two titled sections */}
      <div className="mb-6 flex flex-col gap-8">
        <Skeleton variant="rectangular" height={140} />
        {[1, 2].map((row) => (
          <div key={row} className="grid gap-2.5 md:grid-cols-[240px_minmax(0,1fr)] md:gap-10">
            <div>
              <Skeleton variant="text" width={120} height={22} />
              <Skeleton variant="text" width={200} height={16} className="mt-1" />
            </div>
            <Skeleton variant="rectangular" height={120} />
          </div>
        ))}
      </div>

      {/* Loading skeleton for Accordions */}
      {[1, 2, 3, 4, 5].map((index) => (
        <Skeleton
          key={index}
          variant="rectangular"
          height={48}
          style={{ marginBottom: 24, borderRadius: 'var(--radius-ui)' }}
        />
      ))}

      {/* Loading skeleton for Account & Security */}
      <Card elevation={2} style={{ marginBottom: 24, border: '1px solid var(--border)' }}>
        <CardContent>
          <Skeleton variant="text" width={150} height={28} style={{ marginBottom: 16 }} />
          <Skeleton variant="rectangular" width={130} height={36} />
        </CardContent>
      </Card>

      {/* Loading skeleton for Save button */}
      {!compact && (
        <>
          <div style={{ height: 88 }} />
          <div
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'var(--card)',
              borderTop: '1px solid var(--border)',
              padding: 16,
              zIndex: 1300,
            }}
          >
            <Skeleton
              variant="rectangular"
              height={48}
              style={{
                maxWidth: 500,
                margin: '0 auto',
                borderRadius: 'var(--radius-ui)',
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default ConfigurationSkeleton;
