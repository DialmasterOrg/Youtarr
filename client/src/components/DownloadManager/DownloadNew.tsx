import React from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Grid,
  TextField,
  Typography,
  Box,
} from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

interface DownloadNewProps {
  videoUrls: string;
  setVideoUrls: React.Dispatch<React.SetStateAction<string>>;
  token: string | null;
  fetchRunningJobs: () => void;
  downloadInitiatedRef: React.MutableRefObject<boolean>;
}

const DownloadNew: React.FC<DownloadNewProps> = ({
  videoUrls,
  setVideoUrls,
  token,
  fetchRunningJobs,
  downloadInitiatedRef,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const handleTriggerChannelDownloads = async () => {
    downloadInitiatedRef.current = true;
    const result = await fetch("/triggerchanneldownloads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-access-token": token || "",
      },
    });
    // If the result is a 400 then we already have a running Channel Download
    // job and we should display an alert
    if (result.status === 400) {
      alert("Channel Download already running");
    }
    setTimeout(fetchRunningJobs, 1000);
  };

  const handleSpecificDownloads = async () => {
    downloadInitiatedRef.current = true;
    const strippedUrls = videoUrls
      .split(/[\n\s]/) // split on newline or space
      .map((url) =>
        url.includes("&") ? url.substring(0, url.indexOf("&")) : url
      ); // remove '&' and everything after it
    await fetch("/triggerspecificdownloads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-access-token": token || "",
      },
      body: JSON.stringify({ urls: strippedUrls }),
    });
    // Clear the TextField after download is triggered
    setVideoUrls("");
    setTimeout(fetchRunningJobs, 1000);
  };

  return (
    <Grid item xs={12} md={12}>
      <Card elevation={8}>
        <CardHeader
          title="Start Downloads"
          align="center"
          style={{ marginBottom: "-16px" }}
        />
        <CardContent>
          <Typography variant="body1">
            Enter urls, one per line or space separated
            <br />
            Eg: https://www.youtube.com/watch?v=SETDSFhhQWM
          </Typography>
          <TextField
            style={{ marginBottom: "16px" }}
            multiline
            rows={4}
            variant="outlined"
            fullWidth
            value={videoUrls}
            onChange={(e) => setVideoUrls(e.target.value)}
          />
          <Typography align="center" variant="body1" component="div">
            <Box
              display="flex"
              flexDirection={isMobile ? "column" : "row"}
              justifyContent="center"
              alignItems="center"
              gap={2} // This is to add some space between the buttons
            >
              <Button variant="contained" onClick={handleSpecificDownloads}>
                Download Specific URLS Above
              </Button>
              <Button
                variant="contained"
                onClick={handleTriggerChannelDownloads}
              >
                Download new from all channels
              </Button>
            </Box>
          </Typography>
        </CardContent>
      </Card>
    </Grid>
  );
};

export default DownloadNew;
