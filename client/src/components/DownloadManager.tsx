import React, {
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { Grid } from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import axios from 'axios';
import { Navigate, Route, Routes } from 'react-router-dom';
import DownloadProgress from './DownloadManager/DownloadProgress';
import DownloadHistory from './DownloadManager/DownloadHistory';
import DownloadManualPage from './DownloadManager/DownloadManualPage';
import DownloadChannelPage from './DownloadManager/DownloadChannelPage';
import WebSocketContext from '../contexts/WebSocketContext';
import { Job } from '../types/Job';

interface DownloadManagerProps {
  token: string | null;
}

function DownloadManager({ token }: DownloadManagerProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const downloadInitiatedRef = useRef(false);
  const downloadProgressRef = useRef<{ index: number | null; message: string }>(
    { index: null, message: '' }
  );
  const wsContext = useContext(WebSocketContext);
  if (!wsContext) {
    throw new Error('WebSocketContext not found');
  }

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const { subscribe, unsubscribe } = wsContext;

  const filter = useCallback((message: any) => {
    return (
      message.destination === 'broadcast' && message.type === 'downloadComplete'
    );
  }, []);

  const fetchRunningJobs = useCallback(() => {
    if (token) {
      axios
        .get('/runningjobs', {
          headers: {
            'x-access-token': token,
          },
        })
        .then((response) => {
          if (response.data) {
            setJobs(response.data);
          }
        });
    }
  }, [token]);

  const processMessagesCallback = useCallback(
    (payload: any) => {
      fetchRunningJobs();
    },
    [fetchRunningJobs]
  );

  useEffect(() => {
    fetchRunningJobs();
    subscribe(filter, processMessagesCallback);
    return () => {
      unsubscribe(processMessagesCallback);
    };
  }, [subscribe, unsubscribe, filter, processMessagesCallback]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer); // Clean up the interval on unmount
  }, []);

  // This function toggles the expanded state for a single job.
  const handleExpandCell = (id: string) => {
    setExpanded((prevState) => ({
      ...prevState,
      [id]: !prevState[id],
    }));
  };

  // Filter pending jobs
  const pendingJobs = jobs.filter(job => job.status === 'Pending');

  return (
    <Routes>
      <Route index element={<Navigate to="manual" replace />} />
      <Route
        path="manual"
        element={
          <Grid container spacing={2}>
            <DownloadManualPage
              token={token}
              fetchRunningJobs={fetchRunningJobs}
              downloadInitiatedRef={downloadInitiatedRef}
            />
          </Grid>
        }
      />
      <Route
        path="channel"
        element={
          <Grid container spacing={2}>
            <DownloadChannelPage
              token={token}
              fetchRunningJobs={fetchRunningJobs}
              downloadInitiatedRef={downloadInitiatedRef}
            />
          </Grid>
        }
      />
      <Route
        path="activity"
        element={
          <Grid container spacing={2}>
            <DownloadProgress
              downloadProgressRef={downloadProgressRef}
              downloadInitiatedRef={downloadInitiatedRef}
              pendingJobs={pendingJobs}
              token={token}
            />
          </Grid>
        }
      />
      <Route
        path="history"
        element={
          <Grid container spacing={2}>
            <DownloadHistory
              jobs={jobs}
              expanded={expanded}
              handleExpandCell={handleExpandCell}
              currentTime={currentTime}
              isMobile={isMobile}
            />
          </Grid>
        }
      />
      <Route path="*" element={<Navigate to="." replace />} />
    </Routes>
  );
}

export default DownloadManager;
