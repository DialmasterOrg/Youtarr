import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

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
    <div className="App">
      <p>YoutubePlexArr Youtube Video Downloader</p>
      <header className="App-header">
        <p>Node BE test data: {data && <p>{data.message}</p>}</p>
      </header>
    </div>
  );
}

export default App;
