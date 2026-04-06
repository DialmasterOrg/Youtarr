import React, { useCallback, useEffect, useRef } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';

import { useImportFlow } from './hooks/useImportFlow';
import { usePreviewUpload } from './hooks/usePreviewUpload';
import { useImportJob } from './hooks/useImportJob';

import SourcePicker from './components/SourcePicker';
import ReviewTable from './components/ReviewTable';
import BulkActionsBar from './components/BulkActionsBar';
import DisclaimerBanner from './components/DisclaimerBanner';
import ImportProgress from './components/ImportProgress';
import ImportSummary from './components/ImportSummary';
import RecentImportsSection from './components/RecentImportsSection';

import { ImportSource } from '../../types/subscriptionImport';

interface ImportSubscriptionsPageProps {
  token: string;
}

const ImportSubscriptionsPage: React.FC<ImportSubscriptionsPageProps> = ({ token }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state, dispatch } = useImportFlow();
  const { loading: uploadLoading, error: uploadError, upload } = usePreviewUpload(token);
  const { jobDetail } = useImportJob(state.activeJobId, token);
  const prevStatusRef = useRef<string | null>(null);

  // Support ?job=<id> URL parameter to resume watching an import
  useEffect(() => {
    const jobParam = searchParams.get('job');
    if (jobParam && state.phase === 'source') {
      dispatch({ type: 'START_IMPORT', payload: jobParam });
    }
  }, [searchParams, state.phase, dispatch]);

  // Detect job completion to transition from importing to complete
  useEffect(() => {
    if (!jobDetail) return;

    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = jobDetail.status;

    if (prevStatus === 'In Progress' && jobDetail.status !== 'In Progress') {
      dispatch({ type: 'IMPORT_COMPLETE' });
    }
  }, [jobDetail, dispatch]);

  const handleSourceSubmit = useCallback(async (source: ImportSource, file: File) => {
    dispatch({ type: 'SET_SOURCE', payload: source });
    dispatch({ type: 'PREVIEW_LOADING' });
    try {
      const preview = await upload(source, file);
      dispatch({ type: 'PREVIEW_SUCCESS', payload: { channels: preview.channels } });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      dispatch({ type: 'PREVIEW_ERROR', payload: message });
    }
  }, [dispatch, upload]);

  const handleStartImport = useCallback(async () => {
    const channels = state.channels
      .filter((ch) => state.rowStates[ch.channelId]?.selected)
      .map((ch) => ({
        channelId: ch.channelId,
        url: ch.url,
        title: ch.title,
        settings: state.rowStates[ch.channelId].settings,
      }));

    if (channels.length === 0) return;

    try {
      const res = await axios.post<{ jobId: string }>(
        '/api/subscriptions/imports',
        { channels },
        { headers: { 'x-access-token': token } },
      );
      dispatch({ type: 'START_IMPORT', payload: res.data.jobId });
    } catch {
      // Could add error handling here in the future
    }
  }, [state.channels, state.rowStates, token, dispatch]);

  const handleCancelImport = useCallback(async () => {
    if (!state.activeJobId) return;
    try {
      await axios.post(
        `/api/subscriptions/imports/${state.activeJobId}/cancel`,
        {},
        { headers: { 'x-access-token': token } },
      );
    } catch {
      // Cancel is best-effort
    }
  }, [state.activeJobId, token]);

  const importDisabled = uploadLoading;

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/channels')} size="small">
          Back to channels
        </Button>
        <Typography variant="h5" sx={{ ml: 1 }}>Import Subscriptions</Typography>
      </Box>

      {(state.phase === 'source' || state.phase === 'preview-loading') && (
        <SourcePicker
          loading={uploadLoading}
          error={state.error}
          errorDetails={uploadError?.details}
          onSubmit={handleSourceSubmit}
        />
      )}

      {state.phase === 'reviewing' && (
        <>
          <DisclaimerBanner />
          <BulkActionsBar
            channels={state.channels}
            rowStates={state.rowStates}
            dispatch={dispatch}
            onStartImport={handleStartImport}
            importDisabled={importDisabled}
          />
          <ReviewTable
            channels={state.channels}
            rowStates={state.rowStates}
            dispatch={dispatch}
          />
        </>
      )}

      {state.phase === 'importing' && jobDetail && (
        <ImportProgress
          jobDetail={jobDetail}
          onCancel={handleCancelImport}
        />
      )}

      {state.phase === 'complete' && jobDetail && (
        <ImportSummary jobDetail={jobDetail} />
      )}

      <RecentImportsSection token={token} currentPhase={state.phase} />
    </Box>
  );
};

export default ImportSubscriptionsPage;
