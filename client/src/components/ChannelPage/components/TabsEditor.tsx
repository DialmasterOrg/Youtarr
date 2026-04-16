import React, { useState } from 'react';
import axios from 'axios';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Typography
} from '../../ui';
import { Refresh as RefreshIcon } from '../../../lib/icons';

const TAB_TYPE_ORDER: string[] = ['videos', 'shorts', 'streams'];
const TAB_LABEL: Record<string, string> = {
  videos: 'Videos',
  shorts: 'Shorts',
  streams: 'Live / Streams'
};

export interface TabsEditorRefreshResult {
  availableTabs: string[];
  detectedTabs: string[];
  hiddenTabs: string[];
  autoDownloadEnabledTabs?: string;
}

interface TabsEditorProps {
  channelId: string;
  token: string | null;
  detectedTabs: string[];
  hiddenTabs: string[];
  onHiddenTabsChange: (nextHidden: string[]) => void;
  onRefresh: (result: TabsEditorRefreshResult) => void;
  disabled?: boolean;
}

function TabsEditor({
  channelId,
  token,
  detectedTabs,
  hiddenTabs,
  onHiddenTabsChange,
  onRefresh,
  disabled = false
}: TabsEditorProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const hiddenSet = new Set(hiddenTabs);
  const effectiveTabs = detectedTabs.filter((tab) => !hiddenSet.has(tab));
  const allHidden = detectedTabs.length > 0 && effectiveTabs.length === 0;

  // Ensure tabs always render in a stable order, even if the backend returns them shuffled.
  const orderedDetectedTabs = TAB_TYPE_ORDER.filter((tab) => detectedTabs.includes(tab));

  const handleToggle = (tab: string, visible: boolean) => {
    // `visible` true  = checkbox checked = tab NOT hidden
    // `visible` false = checkbox unchecked = tab IS hidden
    const next = new Set(hiddenSet);
    if (visible) {
      next.delete(tab);
    } else {
      next.add(tab);
    }
    onHiddenTabsChange(Array.from(next));
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const { data } = await axios.post<TabsEditorRefreshResult>(
        `/api/channels/${channelId}/tabs/redetect`,
        null,
        { headers: { 'x-access-token': token || '' } }
      );
      onRefresh({
        availableTabs: Array.isArray(data.availableTabs) ? data.availableTabs : [],
        detectedTabs: Array.isArray(data.detectedTabs) ? data.detectedTabs : [],
        hiddenTabs: Array.isArray(data.hiddenTabs) ? data.hiddenTabs : [],
        autoDownloadEnabledTabs: typeof data.autoDownloadEnabledTabs === 'string'
          ? data.autoDownloadEnabledTabs
          : undefined,
      });
    } catch (err) {
      let message = 'Failed to refresh tabs';
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        message = err.response.data.error;
      } else if (err instanceof Error) {
        message = err.message;
      }
      setRefreshError(message);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Typography variant="subtitle1" style={{ fontWeight: 'bold' }}>
        Channel Tabs
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Choose which YouTube tabs to use for this channel. Unchecking a tab hides it from the
        channel page and the channel list, and disables its auto-download. Use &quot;Refresh
        from YouTube&quot; if the detected tabs look wrong (e.g. a channel only shows as having
        Shorts).
      </Typography>

      {orderedDetectedTabs.length === 0 ? (
        <Alert severity="info">
          No tabs have been detected for this channel yet. Click &quot;Refresh from YouTube&quot;
          to run detection now.
        </Alert>
      ) : (
        <Box style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 4 }}>
          {orderedDetectedTabs.map((tab) => (
            <FormControlLabel
              key={tab}
              control={
                <Checkbox
                  inputProps={{ 'data-testid': `tabs-editor-checkbox-${tab}` } as React.InputHTMLAttributes<HTMLInputElement>}
                  checked={!hiddenSet.has(tab)}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleToggle(tab, e.target.checked)}
                  disabled={disabled || refreshing}
                />
              }
              label={TAB_LABEL[tab] || tab}
            />
          ))}
        </Box>
      )}

      {allHidden && (
        <Alert severity="error">
          At least one tab must remain visible.
        </Alert>
      )}

      {refreshError && (
        <Alert severity="error" onClose={() => setRefreshError(null)}>
          {refreshError}
        </Alert>
      )}

      <Box style={{ marginTop: 4 }}>
        <Button
          data-testid="tabs-editor-refresh"
          variant="outlined"
          size="small"
          startIcon={refreshing ? <CircularProgress size={14} /> : <RefreshIcon />}
          onClick={handleRefresh}
          disabled={disabled || refreshing}
        >
          {refreshing ? 'Refreshing...' : 'Refresh from YouTube'}
        </Button>
      </Box>
    </Box>
  );
}

export default TabsEditor;
