import React, {
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from 'react';
import { Grid, Card, CardHeader, CardContent, Typography } from '@mui/material';
import WebSocketContext from '../../contexts/WebSocketContext';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

interface DownloadProgressProps {
  downloadProgressRef: React.MutableRefObject<{
    index: number | null;
    message: string;
  }>;
  downloadInitiatedRef: React.MutableRefObject<boolean>;
}

const DownloadProgress: React.FC<DownloadProgressProps> = ({
  downloadProgressRef,
  downloadInitiatedRef,
}) => {
  const [socketOutput, setSocketOutput] = useState<string[]>([]);
  const fileDownloadNumber = useRef<number>(0); // [0, 1, 2, 3, 4, 5, 6, 7, 8, 9
  const prevFileDownloadNumber = useRef<number>(-1); // [0, 1, 2, 3, 4, 5, 6, 7, 8, 9
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const wsContext = useContext(WebSocketContext);
  if (!wsContext) {
    throw new Error('WebSocketContext not found');
  }
  const { subscribe, unsubscribe } = wsContext;

  const filter = useCallback((message: any) => {
    // DEBUG
    //console.log('Filtering message: ', message);
    return (
      message.destination === 'broadcast' && message.type === 'downloadProgress'
    );
  }, []);

  const addLineToOutput = useCallback((line: string) => {
    setSocketOutput((prevOutput) => {
      if (prevOutput[prevOutput.length - 1] !== line) {
        return [...prevOutput, line];
      }
      // If it's a duplicate line, just return the current output
      return prevOutput;
    });
  }, []);

  const processMessagesCallback = useCallback(
    (payload: any) => {
      let line = payload.text.trim();

      // Check for and remove duplicate lines within the same message
      const downloadTag = '[download]';
      if (
        line.includes(downloadTag) &&
        line.indexOf(downloadTag) !== line.lastIndexOf(downloadTag)
      ) {
        const downloadTagIndex = line.indexOf(downloadTag, downloadTag.length);
        line = line.substring(0, downloadTagIndex);
      }

      const parts = line.split(/(\s+)/).filter((x: string) => x.trim() !== '');

      if (
        line.startsWith('[download]') &&
        (parts[parts.length - 2] === 'ETA' ||
          line.includes('ETA Unknown') ||
          line.startsWith('[download] 100%'))
      ) {
        const outputLine = line.replace('[download]', '').trim();

        if (
          downloadProgressRef.current.index === null &&
          prevFileDownloadNumber.current !== fileDownloadNumber.current
        ) {
          setSocketOutput((prevOutput) => {
            const newOutput = [...prevOutput, outputLine];
            downloadProgressRef.current = {
              index: newOutput.length - 1,
              message: outputLine,
            };
            return newOutput;
          });
          prevFileDownloadNumber.current = fileDownloadNumber.current;
        } else {
          setSocketOutput((prevOutput) => {
            const newOutput = [...prevOutput];
            newOutput[downloadProgressRef.current.index as number] = outputLine;
            return newOutput;
          });
        }

        downloadProgressRef.current.message = outputLine;
      } else if (
        line.startsWith('[download]') &&
        line.includes('Destination:')
      ) {
        // Remove the path from the filename
        let filename = line.split(/[\\/]/).pop();
        // Remove the youtube video id and the extension from the filename (last 18 characters)
        filename = filename?.substring(0, filename.length - 18);
        fileDownloadNumber.current += 1;
        line = `Video: ${filename}`;
        addLineToOutput(line);

        // Reset the index in the ref, to indicate the start of a new download
        downloadProgressRef.current.index = null;
      } else if (line.startsWith('Completed:')) {
        addLineToOutput(line);

        // Reset download progress ref
        downloadProgressRef.current = { index: null, message: '' };
        // Capture download start, line contains: "[youtube:tab] Extracting URL:"
      } else if (
        (line.includes('[youtube] Extracting URL:') ||
          line.includes('[youtube:tab] Extracting URL:')) &&
        downloadInitiatedRef.current
      ) {
        addLineToOutput('Download initiated...');
        downloadInitiatedRef.current = false;
      } else if (line.includes('[Metadata] Adding metadata to')) {
        addLineToOutput('Processing file...');
      }
    },
    [addLineToOutput]
  );

  useEffect(() => {
    subscribe(filter, processMessagesCallback);
    return () => {
      unsubscribe(processMessagesCallback);
    };
  }, [subscribe, unsubscribe, filter, processMessagesCallback]);

  const linesToDisplay = isMobile ? -4 : -8;
  return (
    <Grid item xs={12} md={12} paddingBottom={'8px'}>
      <Card elevation={8}>
        <CardHeader title='Recent Activity' align='center' />
        <CardContent
          style={{
            borderTop: '1px solid lightgrey',
            width: '100%',
            height: isMobile ? '70px' : '140px',
            overflow: 'auto',
            paddingLeft: '8px',
            paddingTop: '8px',
          }}
        >
          <Typography
            align='left'
            variant='body1'
            fontSize='small'
            component='div'
          >
            {socketOutput.slice(linesToDisplay).map((line, index) => (
              <div
                key={index}
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {line}
              </div>
            ))}
          </Typography>
        </CardContent>
      </Card>
    </Grid>
  );
};

export default DownloadProgress;
