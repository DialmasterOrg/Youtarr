import React, { useState, useEffect } from 'react';
import { Button, Card, CardContent, CardHeader, Grid, TextField, Typography, Table, TableContainer, TableBody, TableHead, TableRow, TableCell } from '@mui/material';
import axios from 'axios';

interface DownloadManagerProps {
  token: string | null;
}

interface Job {
  jobType: string;
  status: string;
  output: string;
  timeStarted: number;
}

function DownloadManager({ token }: DownloadManagerProps) {
  const [videoUrls, setVideoUrls] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchRunningJobs();
    const intervalId = setInterval(fetchRunningJobs, 5000); // fetch every 5s
    return () => clearInterval(intervalId); // clear interval on component unmount
  }, [token]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer); // Clean up the interval on unmount
  }, []);

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
    const strippedUrls = videoUrls.split(/[\n\s]/) // split on newline or space
      .map(url => url.includes('&') ? url.substring(0, url.indexOf('&')) : url); // remove '&' and everything after it
    await fetch('/triggerspecificdownloads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token || ''
      },
      body: JSON.stringify({ urls: strippedUrls }),
    });
    // Clear the TextField after download is triggered
    setVideoUrls('');
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
              Enter YouTube video URLs, one per line, or separated by spaces.:
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
          <CardHeader title="Recent Downloads" />
          <CardContent>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell style={{ fontWeight: 'bold'}}>Job Type</TableCell>
                    <TableCell style={{ fontWeight: 'bold'}}>Status</TableCell>
                    <TableCell style={{ fontWeight: 'bold'}}>Running Time</TableCell>
                    <TableCell style={{ fontWeight: 'bold'}}>Output</TableCell>
                  </TableRow>
                </TableHead>
                { jobs.length === 0 &&
                  <TableBody>
                    <TableRow>
                      <TableCell colSpan={4}>No jobs currently running</TableCell>
                    </TableRow>
                  </TableBody>
                }
                <TableBody>
                  {jobs.map((job, index) => {
                    const jobStartTime = new Date(job.timeStarted).getTime(); // Convert to milliseconds
                    const duration = new Date(currentTime.getTime() - jobStartTime); // Subtract in milliseconds                    const hh = String(duration.getUTCHours()).padStart(2, '0');
                    const mm = String(duration.getUTCMinutes()).padStart(2, '0');
                    const ss = String(duration.getUTCSeconds()).padStart(2, '0');
                    let durationString = `${mm}:${ss}`;
                    if (job.status !== 'In Progress') {
                      durationString = 'Completed';
                    }
                    return (
                      <TableRow key={index}>
                        <TableCell>{job.jobType}</TableCell>
                        <TableCell>{job.status}</TableCell>
                        <TableCell>{durationString}</TableCell>
                        <TableCell>{job.output}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default DownloadManager;
