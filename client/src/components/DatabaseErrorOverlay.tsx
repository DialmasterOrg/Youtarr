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
} from './ui';
import { ErrorOutline as ErrorOutlineIcon, Refresh as RefreshIcon, Storage as StorageIcon, WarningAmber as WarningAmberIcon, CheckCircle as CheckCircleIcon, AccessTime as AccessTimeIcon } from '../lib/icons';

interface DatabaseErrorOverlayProps {
  errors: string[];
  onRetry: () => void;
  recovered?: boolean;
  countdown?: number;
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

const DatabaseErrorOverlay: React.FC<DatabaseErrorOverlayProps> = ({
  errors,
  onRetry,
  recovered = false,
  countdown = 15
}) => {
  const hasConnectionError = errors.some(e => categorizeError(e) === 'connection');
  const hasSchemaError = errors.some(e => categorizeError(e) === 'schema');

  return (
    <Box
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--overlay-backdrop-background-strong)', backdropFilter: 'var(--overlay-backdrop-filter)', zIndex: 9999, position: 'fixed', top: 0, left: 0 }}
      data-testid="database-error-overlay"
    >
      <Paper
        elevation={24}
        className="w-full max-w-[900px] p-6 sm:p-10 max-h-[90vh] overflow-auto"
      >
        {/* Header */}
        <Box className="flex items-center mb-4 gap-4">
          {recovered ? (
            <CheckCircleIcon size={56} className="text-success shrink-0" />
          ) : (
            <ErrorOutlineIcon size={56} className="text-destructive shrink-0" />
          )}
          <Box className="flex-1">
            <Typography
              variant="h4"
              component="h1"
              color={recovered ? 'success' : 'error'}
              style={{ fontWeight: 'bold' }}
            >
              {recovered ? 'Database Connection Restored!' : 'Database Issue Detected'}
            </Typography>
            {!recovered && (
              <Box className="flex gap-2 mt-2 flex-wrap">
                {hasConnectionError && (
                  <Chip
                    icon={<StorageIcon size={14} />}
                    label="Connection Error"
                    color="error"
                    size="small"
                  />
                )}
                {hasSchemaError && (
                  <Chip
                    icon={<WarningAmberIcon size={14} />}
                    label="Schema Mismatch"
                    color="warning"
                    size="small"
                  />
                )}
              </Box>
            )}
          </Box>
        </Box>

        <Divider className="mb-6" />

        {/* Recovery Success Message */}
        {recovered && (
          <Alert severity="success" className="mb-6">
            <AlertTitle>
              Connection Re-established
            </AlertTitle>
            The database connection has been successfully restored. The application is now ready to use.
            Click the button below to refresh the page and continue.
          </Alert>
        )}

        {/* Main Error Message */}
        {!recovered && (
          <>
            <Alert severity={hasConnectionError ? "error" : "warning"} className="mb-6">
              <AlertTitle>
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
                  <Box component="ul" className="mt-2 mb-0 pl-4">
                    <li>Database migrations haven't been run after updating the code</li>
                    <li>Old database migrations are being mounted instead of using the migrations built into the docker image</li>
                    <li>The code was updated but the database wasn't migrated</li>
                    <li>Manual changes were made to the database structure</li>
                  </Box>
                </>
              )}
            </Alert>

            {/* Countdown Display */}
            <Alert severity="info" icon={<AccessTimeIcon size={20} />} className="mb-6">
              <Box className="flex items-center gap-2">
                <Typography variant="body1" style={{ fontWeight: 'bold' }}>
                  Checking again in {countdown} second{countdown !== 1 ? 's' : ''}...
                </Typography>
              </Box>
            </Alert>
          </>
        )}

        {/* Error List - only show when not recovered */}
        {!recovered && errors && errors.length > 0 && (
          <Box className="mb-6">
            <Typography variant="h6" gutterBottom style={{ fontWeight: 'bold' }}>
              Specific Errors:
            </Typography>
            <Paper
              variant="outlined"
              className="max-h-[300px] overflow-auto p-4 bg-muted/30"
            >
              <List dense>
                {errors.map((error, index) => (
                  <ListItem
                    key={index}
                    className="pl-0 items-start"
                  >
                    <Box
                      component="span"
                      className="min-w-[24px] text-destructive font-bold mr-2"
                    >
                      •
                    </Box>
                    <ListItemText
                      primary={error}
                      className="font-mono text-sm break-words"
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Box>
        )}

        {/* Troubleshooting Steps - only show when not recovered */}
        {!recovered && (
          <Box className="mb-6">
            <Typography variant="h6" gutterBottom style={{ fontWeight: 'bold' }} color="primary">
              How to Fix This:
            </Typography>
          {hasConnectionError ? (
            <Paper className="p-4 bg-muted/30">
              <List>
                <ListItem>
                  <ListItemText
                    primary={<Typography style={{ fontWeight: 'bold' }}>1. Check database container status</Typography>}
                    secondary={
                      <Box component="code" className="block mt-2 p-2 bg-muted rounded text-sm font-mono">
                        docker compose ps
                      </Box>
                    }
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={<Typography style={{ fontWeight: 'bold' }}>2. Start the database if it's not running</Typography>}
                    secondary={
                      <Box component="code" className="block mt-2 p-2 bg-muted rounded text-sm font-mono">
                        docker compose up -d youtarr-db
                      </Box>
                    }
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={<Typography style={{ fontWeight: 'bold' }}>3. Check database logs for errors</Typography>}
                    secondary={
                      <Box component="code" className="block mt-2 p-2 bg-muted rounded text-sm font-mono">
                        docker compose logs -f youtarr-db
                      </Box>
                    }
                  />
                </ListItem>
              </List>
            </Paper>
          ) : hasSchemaError ? (
            <Paper className="p-4 bg-warning/10">
              <List>
                <ListItem>
                  <ListItemText
                    primary={<Typography style={{ fontWeight: 'bold' }}>1. Restart the application to run migrations</Typography>}
                    secondary={
                      <>
                        <Typography variant="body2" className="mt-2">
                          This will automatically apply any pending database migrations:
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={<Typography style={{ fontWeight: 'bold' }}>2. Check application logs</Typography>}
                    secondary={
                      <>
                        <Typography variant="body2" className="mt-2">
                          Look for migration errors or schema validation messages:
                        </Typography>
                        <Box component="code" className="block mt-2 p-2 bg-muted rounded text-sm font-mono">
                          docker compose logs -f youtarr
                        </Box>
                      </>
                    }
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={<Typography style={{ fontWeight: 'bold' }}>3. If problem persists, check for code/database sync issues</Typography>}
                    secondary={
                      <Typography variant="body2" className="mt-2">
                        The application code may have been updated without the database being migrated, or vice versa.
                      </Typography>
                    }
                  />
                </ListItem>
              </List>
            </Paper>
          ) : (
            <Paper className="p-4 bg-muted/30">
              <List>
                <ListItem>
                  <ListItemText
                    primary={<Typography style={{ fontWeight: 'bold' }}>Check the application logs for details</Typography>}
                    secondary={
                      <Box component="code" className="block mt-2 p-2 bg-muted rounded text-sm font-mono">
                        docker compose logs -f youtarr
                      </Box>
                    }
                  />
                </ListItem>
              </List>
            </Paper>
          )}
          </Box>
        )}

        <Divider className="mb-6" />

        {/* Action Button */}
        <Box className="flex justify-center mb-4">
          <Button
            variant="contained"
            color={recovered ? "success" : "primary"}
            size="lg"
            startIcon={<RefreshIcon size={16} />}
            onClick={onRetry}
            data-testid="retry-button"
            style={{ fontSize: '1.1rem', fontWeight: 'bold', paddingLeft: '2rem', paddingRight: '2rem' }}
          >
            {recovered ? 'Refresh to Continue' : 'Refresh & Check Again'}
          </Button>
        </Box>

        {/* Footer Note */}
        <Alert severity="info" icon={false} className="text-center">
          <Typography variant="body2" style={{ fontWeight: 500 }}>
            After fixing the issue, click "Refresh & Check Again" to reload the application.
          </Typography>
        </Alert>
      </Paper>
    </Box>
  );
};

export default DatabaseErrorOverlay;
