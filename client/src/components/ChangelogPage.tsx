import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Button,
  Link,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReactMarkdown from 'react-markdown';
import { useChangelog } from '../hooks/useChangelog';

const CHANGELOG_GITHUB_URL =
  'https://github.com/DialmasterOrg/Youtarr/blob/main/CHANGELOG.md';

function ChangelogPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { content, loading, error, refetch } = useChangelog();

  return (
    <Card elevation={8} style={{ marginBottom: '16px' }}>
      <CardContent>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Typography
            variant={isMobile ? 'h6' : 'h5'}
            component="h2"
            align="center"
            sx={{ flexGrow: 1 }}
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
        </Box>

        {loading && (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
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
            <Button onClick={refetch} size="small" sx={{ mt: 1 }}>
              Retry
            </Button>
          </Alert>
        )}

        {content && !loading && (
          <Box
            sx={{
              '& h1, & h2, & h3': {
                color: 'primary.main',
                mt: 2,
                mb: 1,
              },
              '& h1': { fontSize: '1.75rem' },
              '& h2': {
                fontSize: '1.5rem',
                borderBottom: `1px solid ${theme.palette.divider}`,
                pb: 1,
              },
              '& h3': { fontSize: '1.25rem' },
              '& a': {
                color: 'primary.main',
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' },
              },
              '& ul, & ol': {
                pl: 3,
                mb: 2,
              },
              '& li': {
                mb: 0.5,
              },
              '& code': {
                backgroundColor: 'action.hover',
                padding: '2px 6px',
                borderRadius: 1,
                fontFamily: 'var(--font-body)',
              },
              '& pre': {
                backgroundColor: 'action.hover',
                padding: 2,
                borderRadius: 1,
                overflow: 'auto',
              },
            }}
          >
            <ReactMarkdown>{content}</ReactMarkdown>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default ChangelogPage;
