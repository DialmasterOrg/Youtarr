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
  useTheme,
} from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import StorageIcon from '@mui/icons-material/Storage';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

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
  const theme = useTheme();
  const hasConnectionError = errors.some(e => categorizeError(e) === 'connection');
  const hasSchemaError = errors.some(e => categorizeError(e) === 'schema');
  const customColors = {
    errorListBackground: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[50],
    errorListBorder: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[200],
    errorText: theme.palette.mode === 'dark' ? theme.palette.error.light : theme.palette.error.main,
    codeBlockBackground: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[100],
    codeBlockInner: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[200],
    warningBackground: theme.palette.mode === 'dark' ? theme.palette.warning.dark : theme.palette.warning.light,
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.5)',
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
          bgcolor: 'background.paper',
        }}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
          {recovered ? (
            <CheckCircleIcon sx={{ fontSize: 56, color: 'success.main' }} />
          ) : (
            <ErrorOutlineIcon sx={{ fontSize: 56, color: 'error.main' }} />
          )}
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="h4"
              component="h1"
              color={recovered ? 'success.main' : 'error.main'}
              fontWeight="bold"
            >
              {recovered ? 'Database Connection Restored!' : 'Database Issue Detected'}
            </Typography>
            {!recovered && (
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
            )}
          </Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Recovery Success Message */}
        {recovered && (
          <Alert severity="success" sx={{ mb: 3 }}>
            <AlertTitle sx={{ fontWeight: 'bold' }}>
              Connection Re-established
            </AlertTitle>
            The database connection has been successfully restored. The application is now ready to use.
            Click the button below to refresh the page and continue.
          </Alert>
        )}

        {/* Main Error Message */}
        {!recovered && (
          <>
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
                  The database is running but the schema doesn&apos;t match the application code. This typically happens when:
                  <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
                    <li>Database migrations haven&apos;t been run after updating the code</li>
                    <li>Old database migrations are being mounted instead of using the migrations built into the docker image</li>
                    <li>The code was updated but the database wasn&apos;t migrated</li>
                    <li>Manual changes were made to the database structure</li>
                  </Box>
                </>
              )}
            </Alert>

            {/* Countdown Display */}
            <Alert severity="info" icon={<AccessTimeIcon />} sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body1" fontWeight="bold">
                  Checking again in {countdown} second{countdown !== 1 ? 's' : ''}...
                </Typography>
              </Box>
            </Alert>
          </>
        )}

        {/* Error List - only show when not recovered */}
        {!recovered && errors && errors.length > 0 && (
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
                backgroundColor: customColors.errorListBackground,
                borderColor: customColors.errorListBorder,
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
                          fontFamily: 'var(--font-body)',
                          fontSize: '0.9rem',
                          color: customColors.errorText,
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

        {/* Troubleshooting Steps - only show when not recovered */}
        {!recovered && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom fontWeight="bold" color="primary">
              How to Fix This:
            </Typography>
          {hasConnectionError ? (
            <Paper sx={{ p: 2, backgroundColor: customColors.codeBlockBackground }}>
              <List>
                <ListItem>
                  <ListItemText
                    primary={<Typography fontWeight="bold">1. Check database container status</Typography>}
                    secondary={
                      <Box component="code" sx={{ display: 'block', mt: 1, p: 1, backgroundColor: customColors.codeBlockInner, borderRadius: 1 }}>
                        docker compose ps
                      </Box>
                    }
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={<Typography fontWeight="bold">2. Start the database if it&apos;s not running</Typography>}
                    secondary={
                      <Box component="code" sx={{ display: 'block', mt: 1, p: 1, backgroundColor: customColors.codeBlockInner, borderRadius: 1 }}>
                        docker compose up -d youtarr-db
                      </Box>
                    }
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={<Typography fontWeight="bold">3. Check database logs for errors</Typography>}
                    secondary={
                      <Box component="code" sx={{ display: 'block', mt: 1, p: 1, backgroundColor: customColors.codeBlockInner, borderRadius: 1 }}>
                        docker compose logs -f youtarr-db
                      </Box>
                    }
                  />
                </ListItem>
              </List>
            </Paper>
          ) : hasSchemaError ? (
            <Paper sx={{ p: 2, backgroundColor: customColors.warningBackground }}>
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
                        <Box component="code" sx={{ display: 'block', mt: 1, p: 1, backgroundColor: customColors.codeBlockInner, borderRadius: 1 }}>
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
            <Paper sx={{ p: 2, backgroundColor: customColors.codeBlockBackground }}>
              <List>
                <ListItem>
                  <ListItemText
                    primary={<Typography fontWeight="bold">Check the application logs for details</Typography>}
                    secondary={
                      <Box component="code" sx={{ display: 'block', mt: 1, p: 1, backgroundColor: customColors.codeBlockInner, borderRadius: 1 }}>
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

        <Divider sx={{ mb: 3 }} />

        {/* Action Button */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Button
            variant="contained"
            color={recovered ? "success" : "primary"}
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
            {recovered ? 'Refresh to Continue' : 'Refresh & Check Again'}
          </Button>
        </Box>

        {/* Footer Note */}
        <Alert severity="info" icon={false} sx={{ textAlign: 'center' }}>
          <Typography variant="body2" fontWeight="medium">
            After fixing the issue, click &quot;Refresh &amp; Check Again&quot; to reload the application.
          </Typography>
        </Alert>
      </Paper>
    </Box>
  );
};

export default DatabaseErrorOverlay;
