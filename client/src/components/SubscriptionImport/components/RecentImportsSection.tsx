import React, { useEffect } from 'react';
import {
  Box, CircularProgress, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import { useImportHistory } from '../hooks/useImportHistory';
import { ImportPhase } from '../../../types/subscriptionImport';

interface RecentImportsSectionProps {
  token: string;
  currentPhase?: ImportPhase;
}

const RecentImportsSection: React.FC<RecentImportsSectionProps> = ({ token, currentPhase }) => {
  const { imports, loading, refetch } = useImportHistory(token);

  // Refetch when an import completes (phase transitions to 'complete')
  useEffect(() => {
    if (currentPhase === 'complete') {
      refetch();
    }
  }, [currentPhase, refetch]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (imports.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Recent Imports
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Channels</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {imports.map((imp) => (
            <TableRow key={imp.jobId}>
              <TableCell>
                {new Date(imp.startedAt).toLocaleDateString()}
              </TableCell>
              <TableCell>{imp.status}</TableCell>
              <TableCell align="right">{imp.total}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
};

export default RecentImportsSection;
