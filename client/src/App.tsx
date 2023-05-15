import './App.css';
import { Container, Typography } from '@mui/material';
import Configuration from './components/Configuration';

function App() {

  return (
    <Container>
      <Typography variant="h2" align="center" gutterBottom>
        YouTubePlexArr
      </Typography>
      <Typography variant="h5" align="center" gutterBottom>
        Youtube Video Downloader for Plex
      </Typography>
      <Configuration />

    </Container>
  );
}

export default App;
