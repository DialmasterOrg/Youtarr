import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  Alert,
  AlertTitle,
  Divider,
  Chip,
} from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import StorageIcon from '@mui/icons-material/Storage';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

interface DatabaseErrorOverlayProps {
  errors: string[];
  onRetry: () => void;
}

// Categorize errors for better display
const categorizeError = (error: string) => {
  if (error.includes('Cannot connect') || error.includes('Connection refused') || error.includes('ECONNREFUSED')) {
    return 'connection';
  } else if (error.includes('missing column') || error.includes('nullable mismatch') || error.includes('missing table')) {
    return 'schema';
  }
  return 'other';
};

const DatabaseErrorOverlay: React.FC<DatabaseErrorOverlayProps> = ({ errors, onRetry }) => {
  const hasConnectionError = errors.some(e => categorizeError(e) === 'connection');
  const hasSchemaError = errors.some(e => categorizeError(e) === 'schema');

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 2,
        backdropFilter: 'blur(4px)',
      }}
      data-testid="database-error-overlay"
    >
      <Paper
        elevation={24}
        sx={{
          maxWidth: 900,
          width: '100%',
          padding: { xs: 3, sm: 5 },
          maxHeight: '90vh',
          overflow: 'auto',
          borderRadius: 2,
          backgroundColor: '#fff',
        }}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
          <ErrorOutlineIcon sx={{ fontSize: 56, color: 'error.main' }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h4" component="h1" color="error.main" fontWeight="bold">
              Database Issue Detected
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
              {hasConnectionError && (
                <Chip
                  icon={<StorageIcon />}
                  label="Connection Error"
                  color="error"
                  size="small"
                />
              )}
              {hasSchemaError && (
                <Chip
                  icon={<WarningAmberIcon />}
                  label="Schema Mismatch"
                  color="warning"
                  size="small"
                />
              )}
            </Box>
          </Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Main Error Message */}
        <Alert severity={hasConnectionError ? "error" : "warning"} sx={{ mb: 3 }}>
          <AlertTitle sx={{ fontWeight: 'bold' }}>
            {hasConnectionError && 'Cannot Connect to Database'}
            {!hasConnectionError && hasSchemaError && 'Database Schema Mismatch'}
            {!hasConnectionError && !hasSchemaError && 'Database Error'}
          </AlertTitle>
          {hasConnectionError && (
            <>
              The application cannot connect to the database server. This usually means the database container is not running or is not accessible.
            </>
          )}
          {!hasConnectionError && hasSchemaError && (
            <>
              The database is running but the schema doesn't match the application code. This typically happens when:
              <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
                <li>Database migrations haven't been run after updating the code</li>
                <li>Old database migrations are being mounted instead of using the migrations built into the docker image</li>
                <li>The code was updated but the database wasn't migrated</li>
                <li>Manual changes were made to the database structure</li>
              </Box>
            </>
          )}
        </Alert>

        {/* Error List */}
        {errors && errors.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              Specific Errors:
            </Typography>
            <Paper
              variant="outlined"
              sx={{
                maxHeight: 300,
                overflow: 'auto',
                p: 2,
                backgroundColor: '#fef6f6',
                border: '1px solid #ffcdd2',
              }}
            >
              <List dense>
                {errors.map((error, index) => (
                  <ListItem
                    key={index}
                    sx={{
                      pl: 0,
                      alignItems: 'flex-start',
                    }}
                  >
                    <Box
                      component="span"
                      sx={{
                        minWidth: '24px',
                        color: 'error.main',
                        fontWeight: 'bold',
                        mr: 1,
                      }}
                    >
                      •
                    </Box>
                    <ListItemText
                      primary={error}
                      sx={{
                        '& .MuiListItemText-primary': {
                          fontFamily: 'monospace',
                          fontSize: '0.9rem',
                          color: '#d32f2f',
                          wordBreak: 'break-word',
                        },
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Box>
        )}

        {/* Troubleshooting Steps */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom fontWeight="bold" color="primary">
            How to Fix This:
          </Typography>
          {hasConnectionError ? (
            <Paper sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
              <List>
                <ListItem>
                  <ListItemText
                    primary={<Typography fontWeight="bold">1. Check database container status</Typography>}
                    secondary={
                      <Box component="code" sx={{ display: 'block', mt: 1, p: 1, backgroundColor: '#fff', borderRadius: 1 }}>
                        docker compose ps
                      </Box>
                    }
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={<Typography fontWeight="bold">2. Start the database if it's not running</Typography>}
                    secondary={
                      <Box component="code" sx={{ display: 'block', mt: 1, p: 1, backgroundColor: '#fff', borderRadius: 1 }}>
                        docker compose up -d youtarr-db
                      </Box>
                    }
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={<Typography fontWeight="bold">3. Check database logs for errors</Typography>}
                    secondary={
                      <Box component="code" sx={{ display: 'block', mt: 1, p: 1, backgroundColor: '#fff', borderRadius: 1 }}>
                        docker compose logs -f youtarr-db
                      </Box>
                    }
                  />
                </ListItem>
              </List>
            </Paper>
          ) : hasSchemaError ? (
            <Paper sx={{ p: 2, backgroundColor: '#fff8e1' }}>
              <List>
                <ListItem>
                  <ListItemText
                    primary={<Typography fontWeight="bold">1. Restart the application to run migrations</Typography>}
                    secondary={
                      <>
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          This will automatically apply any pending database migrations:
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={<Typography fontWeight="bold">2. Check application logs</Typography>}
                    secondary={
                      <>
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          Look for migration errors or schema validation messages:
                        </Typography>
                        <Box component="code" sx={{ display: 'block', mt: 1, p: 1, backgroundColor: '#fff', borderRadius: 1 }}>
                          docker compose logs -f youtarr
                        </Box>
                      </>
                    }
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={<Typography fontWeight="bold">3. If problem persists, check for code/database sync issues</Typography>}
                    secondary={
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        The application code may have been updated without the database being migrated, or vice versa.
                      </Typography>
                    }
                  />
                </ListItem>
              </List>
            </Paper>
          ) : (
            <Paper sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
              <List>
                <ListItem>
                  <ListItemText
                    primary={<Typography fontWeight="bold">Check the application logs for details</Typography>}
                    secondary={
                      <Box component="code" sx={{ display: 'block', mt: 1, p: 1, backgroundColor: '#fff', borderRadius: 1 }}>
                        docker compose logs -f youtarr
                      </Box>
                    }
                  />
                </ListItem>
              </List>
            </Paper>
          )}
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Action Button */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<RefreshIcon />}
            onClick={onRetry}
            data-testid="retry-button"
            sx={{
              paddingX: 4,
              paddingY: 1.5,
              fontSize: '1.1rem',
              fontWeight: 'bold',
              boxShadow: 3,
              '&:hover': {
                boxShadow: 6,
              },
            }}
          >
            Refresh & Check Again
          </Button>
        </Box>

        {/* Footer Note */}
        <Alert severity="info" icon={false} sx={{ textAlign: 'center' }}>
          <Typography variant="body2" fontWeight="medium">
            After fixing the issue, click "Refresh & Check Again" to reload the application.
          </Typography>
        </Alert>
      </Paper>
    </Box>
  );
};

export default DatabaseErrorOverlay;
