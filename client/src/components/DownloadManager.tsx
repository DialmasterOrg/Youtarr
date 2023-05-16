import React, { useState, useEffect } from 'react';
import { Button, Card, CardContent, CardHeader, Grid, TextField, Typography } from '@mui/material';
import axios from 'axios';

interface DownloadManagerProps {
  token: string | null;
}

interface Job {
  status: string;
  output: string;
  timeStarted: number;
}

function DownloadManager({ token }: DownloadManagerProps) {
  const [videoUrls, setVideoUrls] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    const intervalId = setInterval(fetchRunningJobs, 15000); // fetch every 15s

    return () => clearInterval(intervalId); // clear interval on component unmount
  }, [token]);

  const fetchRunningJobs = () => {
    if (token) {
      axios.get('/runningjobs', {
        headers: {
          'x-access-token': token
        }
      }).then(response => {
        setJobs(response.data);
      });
    }
  };

  const handleTriggerChannelDownloads = async () => {
    // Call BE endpoint to trigger channel downloads
    await fetch('/triggerchanneldownloads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token || ''
      },
    });
    // Wait 1 second and then call fetchRunningJobs
    setTimeout(fetchRunningJobs, 1000);
  };

  const handleSpecificDownloads = async () => {
    // Call BE endpoint to trigger specific downloads
    await fetch('/triggerspecificdownloads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token || ''
      },
      body: JSON.stringify({ urls: videoUrls.split('\n') }),
    });
    // Wait 1 second and then call fetchRunningJobs
    setTimeout(fetchRunningJobs, 1000);
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={12}>
        <Card>
          <CardHeader title="Video Channel Downloads" />
          <CardContent>
            <Button variant="contained" onClick={handleTriggerChannelDownloads}>
              Manually trigger download of new channel videos
            </Button>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={12}>
        <Card>
          <CardHeader title="Download Specific Videos" />
          <CardContent>
            <Typography variant="body1">
              Enter YouTube video URLs, one per line:
            </Typography>
            <TextField style={{ marginBottom: '15px'}}
              multiline
              rows={10}
              variant="outlined"
              fullWidth
              value={videoUrls}
              onChange={(e) => setVideoUrls(e.target.value)}
            />
            <Button variant="contained" onClick={handleSpecificDownloads}>
              Download Now
            </Button>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={12}>
        <Card>
          <CardHeader title="Running Jobs" />
          <CardContent>
            {jobs.map((job, index) => (
              <div key={index}>
                <h3>{job.status}</h3>
                <p>{job.output}</p>
                <p>Started at: {new Date(job.timeStarted).toLocaleString()}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default DownloadManager;
