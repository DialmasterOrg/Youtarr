import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
  Breadcrumbs,
  Link,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  ArrowUpward as ArrowUpIcon,
  Home as HomeIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import axios from 'axios';

interface FolderBrowserProps {
  open: boolean;
  currentPath?: string;
  onClose: () => void;
  onSelect: (path: string) => void;
  token: string;
}

interface DirectoryItem {
  name: string;
  path: string;
  isWritable: boolean;
}

interface BrowseResponse {
  currentPath: string;
  parentPath: string | null;
  directories: DirectoryItem[];
  defaultPath: string;
}

const FolderBrowser: React.FC<FolderBrowserProps> = ({
  open,
  currentPath,
  onClose,
  onSelect,
  token,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [browseData, setBrowseData] = useState<BrowseResponse | null>(null);
  const [selectedPath, setSelectedPath] = useState(currentPath || '');

  const fetchDirectories = async (path?: string) => {
    setLoading(true);
    setError('');

    try {
      const response = await axios.get('/api/browse-directories', {
        params: { path },
        headers: { 'x-access-token': token },
      });
      setBrowseData(response.data);
      setSelectedPath(response.data.currentPath);
    } catch (err) {
      console.error('Error browsing directories:', err);
      setError('Failed to browse directories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchDirectories(currentPath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentPath]);

  const handleNavigate = (path: string) => {
    fetchDirectories(path);
  };

  const handleGoToParent = () => {
    if (browseData?.parentPath) {
      fetchDirectories(browseData.parentPath);
    }
  };

  const handleGoToDefault = () => {
    if (browseData?.defaultPath) {
      fetchDirectories(browseData.defaultPath);
    }
  };

  const handleSelect = () => {
    onSelect(selectedPath);
    onClose();
  };

  const getPathBreadcrumbs = () => {
    if (!browseData) return [];

    const parts = browseData.currentPath.split(/[/\\]/).filter(Boolean);
    const breadcrumbs: { name: string; path: string }[] = [];

    // Add root
    breadcrumbs.push({ name: 'Root', path: '/' });

    // Build path incrementally
    let currentPath = '';
    parts.forEach(part => {
      currentPath += '/' + part;
      breadcrumbs.push({ name: part, path: currentPath });
    });

    return breadcrumbs;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { height: '80vh' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">Select Destination Folder</Typography>
          <Box>
            <Tooltip title="Go to default download directory">
              <IconButton onClick={handleGoToDefault} size="small">
                <HomeIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {browseData && (
          <Box sx={{ mb: 2 }}>
            <Breadcrumbs sx={{ mb: 2 }}>
              {getPathBreadcrumbs().map((crumb, index) => {
                const isLast = index === getPathBreadcrumbs().length - 1;
                return isLast ? (
                  <Typography key={crumb.path} color="text.primary">
                    {crumb.name}
                  </Typography>
                ) : (
                  <Link
                    key={crumb.path}
                    component="button"
                    variant="body2"
                    onClick={() => handleNavigate(crumb.path)}
                    underline="hover"
                  >
                    {crumb.name}
                  </Link>
                );
              })}
            </Breadcrumbs>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Current: {browseData.currentPath}
            </Typography>
          </Box>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <List>
            {browseData?.parentPath && (
              <ListItem disablePadding>
                <ListItemButton onClick={handleGoToParent}>
                  <ListItemIcon>
                    <ArrowUpIcon />
                  </ListItemIcon>
                  <ListItemText primary=".." secondary="Parent directory" />
                </ListItemButton>
              </ListItem>
            )}

            {browseData?.directories.map((dir) => (
              <ListItem
                key={dir.path}
                disablePadding
                secondaryAction={
                  selectedPath === dir.path && (
                    <CheckIcon color="primary" />
                  )
                }
              >
                <ListItemButton
                  onClick={() => handleNavigate(dir.path)}
                  selected={selectedPath === dir.path}
                >
                  <ListItemIcon>
                    {selectedPath === dir.path ? <FolderOpenIcon /> : <FolderIcon />}
                  </ListItemIcon>
                  <ListItemText
                    primary={dir.name}
                    secondary={!dir.isWritable ? 'Read-only' : undefined}
                  />
                </ListItemButton>
              </ListItem>
            ))}

            {browseData?.directories.length === 0 && (
              <ListItem>
                <ListItemText
                  primary="No subdirectories"
                  secondary="You can select this folder or go back"
                />
              </ListItem>
            )}
          </List>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSelect}
          variant="contained"
          disabled={!selectedPath || loading}
          startIcon={<CheckIcon />}
        >
          Select This Folder
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FolderBrowser;