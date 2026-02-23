import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Link,
} from './ui';
import { Refresh as RefreshIcon } from '../lib/icons';
import { useMediaQuery } from '../hooks/useMediaQuery';
import ReactMarkdown from 'react-markdown';
import { useChangelog } from '../hooks/useChangelog';

const CHANGELOG_GITHUB_URL =
  'https://github.com/DialmasterOrg/Youtarr/blob/main/CHANGELOG.md';

function ChangelogPage() {
  const isMobile = useMediaQuery('(max-width: 599px)');
  const { content, loading, error, refetch } = useChangelog();

  return (
    <Card elevation={8} style={{ marginBottom: '16px' }}>
      <CardContent>
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}
        >
          <Typography
            variant={isMobile ? 'h6' : 'h5'}
            component="h2"
            align="center"
            style={{ flexGrow: 1 }}
          >
            Changelog
          </Typography>
          <Button
            startIcon={<RefreshIcon />}
            onClick={refetch}
            disabled={loading}
            size="small"
          >
            Refresh
          </Button>
        </div>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
            <CircularProgress />
          </div>
        )}

        {error && (
          <Alert severity="warning" style={{ marginBottom: 16 }}>
            <Typography variant="body2" style={{ marginBottom: 8 }}>
              Unable to load changelog: {error}
            </Typography>
            <Typography variant="body2">
              You can view the changelog directly on GitHub:{' '}
              <Link
                href={CHANGELOG_GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                {CHANGELOG_GITHUB_URL}
              </Link>
            </Typography>
            <Button onClick={refetch} size="small" style={{ marginTop: 8 }}>
              Retry
            </Button>
          </Alert>
        )}

        {content && !loading && (
          <div className="changelog-markdown">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ChangelogPage;
