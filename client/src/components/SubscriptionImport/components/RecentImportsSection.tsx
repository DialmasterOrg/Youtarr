import React, { useEffect } from 'react';
import {
  Card,
  CardContent,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '../../ui';
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
      <div className="flex justify-center py-4">
        <CircularProgress size={24} />
      </div>
    );
  }

  if (imports.length === 0) {
    return null;
  }

  return (
    <Card className="mt-6" variant="outlined">
      <CardContent className="space-y-3">
        <Typography variant="h6">Recent Imports</Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell component="th">Date</TableCell>
              <TableCell component="th">Status</TableCell>
              <TableCell component="th" align="right">Channels</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {imports.map((imp) => (
              <TableRow key={imp.jobId} hover>
                <TableCell>{new Date(imp.startedAt).toLocaleDateString()}</TableCell>
                <TableCell>{imp.status}</TableCell>
                <TableCell align="right">{imp.total}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default RecentImportsSection;
