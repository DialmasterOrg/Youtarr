import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import { Container, Typography } from '@mui/material';
import Configuration from './components/Configuration';

interface ApiResponse {
  message: string;
}

function App() {
  const [data, setData] = useState<ApiResponse | null>(null);

  useEffect(() => {
    // Make a request for data from the /api endpoint
    axios.get('/api')
      .then(function (response) {
        // handle success
        console.log(response);
        setData(response.data);
      })
      .catch(function (error) {
        // handle error
        console.log(error);
      });
  }, []);


  return (
    <Container>
      <Typography variant="h2" align="center" gutterBottom>
        YouTubePlexArr
      </Typography>
      <Typography variant="h5" align="center" gutterBottom>
        Youtube Video Downloader for Plex
      </Typography>
      <Configuration />
      <header className="App-header">
        <div>Node BE test data: {data && <p>{data.message}</p>}</div>
      </header>

    </Container>
  );
}

export default App;
