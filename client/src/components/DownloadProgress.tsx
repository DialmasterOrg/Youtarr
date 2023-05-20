import React, { useEffect, useState, useRef } from "react";
import { Grid, Card, CardHeader, CardContent, Typography } from "@mui/material";
import { useTheme, useMediaQuery } from "@mui/material";

interface DownloadProgressProps {
  downloadProgressRef: React.MutableRefObject<{
    index: number | null;
    message: string;
  }>;
}

const DownloadProgress: React.FC<DownloadProgressProps> = ({
  downloadProgressRef,
}) => {
  const [socketOutput, setSocketOutput] = useState<string[]>([]);
  const fileDownloadNumber = useRef<number>(0); // [0, 1, 2, 3, 4, 5, 6, 7, 8, 9
  const prevFileDownloadNumber = useRef<number>(-1); // [0, 1, 2, 3, 4, 5, 6, 7, 8, 9

  const connectWebSocket = (
    setSocketOutput: React.Dispatch<React.SetStateAction<string[]>>,
    downloadProgressRef: React.MutableRefObject<{
      index: number | null;
      message: string;
    }>
  ) => {
    const host = window.location.hostname;
    const ws = new WebSocket(`ws://${host}:8099`);

    ws.onopen = () => {
      console.log("WebSocket connection opened");
    };

    // Function to add a line to the output, if it's not a duplicate of the last line
    function addLineToOutput(line: string) {
      setSocketOutput((prevOutput) => {
        if (prevOutput[prevOutput.length - 1] !== line) {
          return [...prevOutput, line];
        }
        // If it's a duplicate line, just return the current output
        return prevOutput;
      });
    }

    ws.onmessage = (message: MessageEvent) => {
      let line = message.data.trim();

      // Check for and remove duplicate lines within the same message
      const downloadTag = "[download]";
      if (
        line.includes(downloadTag) &&
        line.indexOf(downloadTag) !== line.lastIndexOf(downloadTag)
      ) {
        const downloadTagIndex = line.indexOf(downloadTag, downloadTag.length);
        line = line.substring(0, downloadTagIndex);
      }

      const parts = line.split(/(\s+)/).filter((x: string) => x.trim() !== "");

      if (
        line.startsWith("[download]") &&
        (parts[parts.length - 2] === "ETA" ||
          line.includes("ETA Unknown") ||
          line.startsWith("[download] 100%"))
      ) {
        const outputLine = line.replace("[download]", "").trim();

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
        line.startsWith("[download]") &&
        line.includes("Destination:")
      ) {
        const filename = line.split(/[\\\/]/).pop();
        fileDownloadNumber.current += 1;
        line = `Video: ${filename}`;
        addLineToOutput(line);

        // Reset the index in the ref, to indicate the start of a new download
        downloadProgressRef.current.index = null;
      } else if (line.startsWith("Completed:")) {
        addLineToOutput(line);

        // Reset download progress ref
        downloadProgressRef.current = { index: null, message: "" };
      }
    };
    ws.onclose = (event) => {
      setTimeout(() => {
        connectWebSocket(setSocketOutput, downloadProgressRef);
      }, 1000);
    };

    ws.onerror = (error) => {
      ws.close();
    };

    return ws;
  };

  useEffect(() => {
    const ws = connectWebSocket(setSocketOutput, downloadProgressRef);

    return () => {
      ws.close();
    };
  }, []);

  return (
    <Grid item xs={12} md={12} paddingBottom={"8px"}>
      <Card elevation={8}>
        <CardHeader title="Recent Activity" align="center" />
        <CardContent
          style={{
            borderTop: "1px solid lightgrey",
            width: "100%",
            height: "140px",
            overflow: "auto",
            paddingLeft: "8px",
            paddingTop: "8px",
          }}
        >
          <Typography
            align="left"
            variant="body1"
            fontSize="small"
            component="div"
          >
            {socketOutput.slice(-8).map((line, index) => (
              <div
                key={index}
                style={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
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
