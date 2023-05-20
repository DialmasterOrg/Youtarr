import React, { useState, useEffect, useRef } from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Grid,
  TextField,
  Typography,
  Table,
  TableContainer,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Popper,
  Box,
} from "@mui/material";
import { IconButton } from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import axios from "axios";
import DownloadProgress from "./DownloadProgress";

interface DownloadManagerProps {
  token: string | null;
}

interface VideoData {
  youtubeId: string;
  youTubeChannelName: string;
  youTubeVideoName: string;
}

interface Job {
  jobType: string;
  status: string;
  output: string;
  timeCreated: number;
  timeInitiated: number;
  id: string;
  data: {
    videos: VideoData[];
  };
}

function DownloadManager({ token }: DownloadManagerProps) {
  const [videoUrls, setVideoUrls] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [anchorEl, setAnchorEl] = useState<
    Record<string, null | HTMLButtonElement>
  >({});
  const downloadProgressRef = useRef<{ index: number | null; message: string }>(
    { index: null, message: "" }
  );

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

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
      axios
        .get("/runningjobs", {
          headers: {
            "x-access-token": token,
          },
        })
        .then((response) => {
          // If there is response data, then set the jobs
          if (response.data) {
            setJobs(response.data);
          }
        });
    }
  };
  // This function toggles the expanded state for a single job.
  const handleExpandCell = (id: string) => {
    setExpanded((prevState) => ({
      ...prevState,
      [id]: !prevState[id],
    }));
  };

  const handleTriggerChannelDownloads = async () => {
    // Call BE endpoint to trigger channel downloads
    //setSocketOutput((prevOutput) =>[]);
    downloadProgressRef.current = { index: null, message: "" };

    await fetch("/triggerchanneldownloads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-access-token": token || "",
      },
    });
    // Wait 1 second and then call fetchRunningJobs
    setTimeout(fetchRunningJobs, 1000);
  };

  const handleSpecificDownloads = async () => {
    // Call BE endpoint to trigger specific downloads
    //setSocketOutput((prevOutput) =>[]);
    downloadProgressRef.current = { index: null, message: "" };

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
    // Wait 1 second and then call fetchRunningJobs
    setTimeout(fetchRunningJobs, 1000);
  };

  return (
    <Grid container spacing={2}>
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
      <DownloadProgress downloadProgressRef={downloadProgressRef} />
      <Grid item xs={12} md={12} paddingBottom={"48px"}>
        <Card elevation={8}>
          <CardHeader
            title="Download History"
            align="center"
            style={{ marginBottom: "-16px" }}
          />
          <CardContent>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell
                      style={{
                        fontSize: isMobile ? "small" : "medium",
                        fontWeight: "bold",
                      }}
                    >
                      Job Type
                    </TableCell>
                    <TableCell
                      style={{
                        fontSize: isMobile ? "small" : "medium",
                        fontWeight: "bold",
                      }}
                    >
                      Created
                    </TableCell>
                    <TableCell
                      style={{
                        fontSize: isMobile ? "small" : "medium",
                        fontWeight: "bold",
                      }}
                    >
                      Status
                    </TableCell>
                    <TableCell
                      style={{
                        fontSize: isMobile ? "small" : "medium",
                        fontWeight: "bold",
                      }}
                    >
                      Output
                    </TableCell>
                  </TableRow>
                </TableHead>
                {jobs.length === 0 && (
                  <TableBody>
                    <TableRow>
                      <TableCell colSpan={4}>
                        No jobs currently running
                      </TableCell>
                    </TableRow>
                  </TableBody>
                )}
                <TableBody>
                  {jobs.map((job, index) => {
                    const isExpanded = expanded[job.id] || false;
                    let durationString = "";
                    if (job.status !== "In Progress") {
                      durationString = job.status;
                    } else {
                      const jobStartTime = new Date(
                        job.timeInitiated
                      ).getTime(); // Convert to milliseconds
                      const duration = new Date(
                        currentTime.getTime() - jobStartTime
                      ); // Subtract in milliseconds                    const hh = String(duration.getUTCHours()).padStart(2, '0');
                      const mm = String(duration.getUTCMinutes()).padStart(
                        2,
                        "0"
                      );
                      const ss = String(duration.getUTCSeconds()).padStart(
                        2,
                        "0"
                      );
                      durationString = `${mm}m${ss}s`;
                    }
                    let timeCreated = new Date(job.timeCreated);
                    let month = String(timeCreated.getMonth() + 1).padStart(
                      2,
                      "0"
                    ); // Add 1 to month and pad with 0s
                    let day = String(timeCreated.getDate()).padStart(2, "0"); // Pad with 0s

                    let minutes = String(timeCreated.getMinutes()).padStart(
                      2,
                      "0"
                    ); // Pad with 0s
                    // Convert 24-hour format to 12-hour format
                    let hours = timeCreated.getHours();
                    let period = hours >= 12 ? "PM" : "AM";

                    // Adjust hours
                    hours = hours % 12;
                    hours = hours ? hours : 12; // the hour '0' should be '12'

                    // Combine into a formatted string
                    let formattedTimeCreated = `${month}-${day} ${hours}:${minutes} ${period}`;

                    return (
                      <TableRow key={index}>
                        <TableCell
                          style={{ fontSize: isMobile ? "small" : "medium" }}
                        >
                          {job.jobType}
                        </TableCell>
                        <TableCell
                          style={{ fontSize: isMobile ? "small" : "medium" }}
                        >
                          {formattedTimeCreated}
                        </TableCell>
                        <TableCell
                          style={{ fontSize: isMobile ? "small" : "medium" }}
                        >
                          {durationString}
                        </TableCell>
                        <TableCell
                          style={{ fontSize: isMobile ? "small" : "medium" }}
                        >
                          <div
                            style={{
                              position: "relative",
                              display: "flex",
                              alignItems: "center",
                            }}
                          >
                            {job.output.length > 50 && (
                              <IconButton
                                onClick={() => handleExpandCell(job.id)}
                              >
                                {isExpanded ? <ExpandLess /> : <ExpandMore />}
                              </IconButton>
                            )}
                            {job.data?.videos?.length > 0 && (
                              <>
                                <IconButton
                                  onClick={(
                                    event: React.MouseEvent<HTMLButtonElement>
                                  ) => {
                                    setAnchorEl({
                                      ...anchorEl,
                                      [job.id]: anchorEl[job.id]
                                        ? null
                                        : event.currentTarget,
                                    });
                                  }}
                                >
                                  {" "}
                                  <InfoIcon fontSize="small" />
                                </IconButton>
                                <Popper
                                  open={Boolean(anchorEl[job.id])}
                                  anchorEl={anchorEl[job.id]}
                                >
                                  <div
                                    style={{
                                      padding: "8px",
                                      backgroundColor: "#f5f5f5",
                                      maxWidth: isMobile ? "85vw" : "320px",
                                      wordBreak: "break-word",
                                    }}
                                  >
                                    <Typography sx={{ padding: 2 }}>
                                      {job.data?.videos?.map((video: any) => (
                                        <p key={video.youtubeId}>
                                          {video.youTubeChannelName} -{" "}
                                          {video.youTubeVideoName}
                                        </p>
                                      ))}
                                    </Typography>
                                  </div>
                                </Popper>
                              </>
                            )}

                            {isExpanded ? (
                              <div
                                style={{
                                  maxWidth: isMobile ? "200px" : "100%",
                                }}
                              >
                                {job.output}
                              </div>
                            ) : (
                              <div
                                style={{
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  width: isMobile ? "100px" : "200px",
                                }}
                              >
                                {job.output}
                              </div>
                            )}
                          </div>
                        </TableCell>
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
}

export default DownloadManager;
