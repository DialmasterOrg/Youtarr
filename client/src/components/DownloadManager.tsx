import React, { useState, useEffect, useRef } from "react";
import { Grid } from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import axios from "axios";
import DownloadProgress from "./DownloadManager/DownloadProgress";
import DownloadHistory from "./DownloadManager/DownloadHistory";
import DownloadNew from "./DownloadManager/DownloadNew";

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
  const downloadInitiatedRef = useRef(false);
  const downloadProgressRef = useRef<{ index: number | null; message: string }>(
    { index: null, message: "" }
  );

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  useEffect(() => {
    fetchRunningJobs();
    const intervalId = setInterval(fetchRunningJobs, 5000);
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

  return (
    <Grid container spacing={2}>
      <DownloadNew
        videoUrls={videoUrls}
        setVideoUrls={setVideoUrls}
        token={token}
        fetchRunningJobs={fetchRunningJobs}
        downloadInitiatedRef={downloadInitiatedRef}
      />
      <DownloadProgress
        downloadProgressRef={downloadProgressRef}
        downloadInitiatedRef={downloadInitiatedRef}
        />
      <DownloadHistory
        jobs={jobs}
        expanded={expanded}
        handleExpandCell={handleExpandCell}
        anchorEl={anchorEl}
        setAnchorEl={setAnchorEl}
        currentTime={currentTime}
        isMobile={isMobile}
      />
    </Grid>
  );
}

export default DownloadManager;
