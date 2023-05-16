import React from 'react';
import PlexAuth from './PLexAuth';
import { Typography, Card, CardContent, CardHeader } from '@mui/material';

interface HomeProps {
  setToken: React.Dispatch<React.SetStateAction<string | null>>;
}

const Login: React.FC<HomeProps> = ({ setToken }) => {
  return (
    <Card title='Sign in to continue'>
      <CardContent>
        <Typography variant="h4" align='center' component="h2" gutterBottom>
          Sign in to continue
        </Typography>
      </CardContent>
      <CardContent>
        <Typography variant="h5" align="center" gutterBottom>
          Use your Plex account to login
        </Typography>
      </CardContent>
      <CardContent>
        <Typography variant="h5" align="center" gutterBottom>
          <PlexAuth setToken={setToken} />
        </Typography>
      </CardContent>
    </Card>
  );
};

export default Login;