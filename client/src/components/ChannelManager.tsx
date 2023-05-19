import React, { useState, useEffect } from "react";
import {
  Tooltip,
  Grid,
  Button,
  Card,
  CardHeader,
  ListItem,
  ListItemSecondaryAction,
  IconButton,
  TextField,
  List,
  ListItemText,
} from "@mui/material";
import Delete from "@mui/icons-material/Delete";
import axios from "axios";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

interface ChannelManagerProps {
  token: string | null;
}

function ChannelManager({ token }: ChannelManagerProps) {
  const [channels, setChannels] = useState<string[]>([]);
  const [newChannel, setNewChannel] = useState<string>("");
  const [unsavedChannels, setUnsavedChannels] = useState<string[]>([]);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  useEffect(() => {
    // Fetch channels from backend on component mount
    if (token) {
      axios
        .get("/getchannels", {
          headers: {
            "x-access-token": token,
          },
        })
        .then((response) => {
          setChannels(response.data);
        });
    }
  }, [token]);

  const handleAdd = () => {
    if (
      newChannel.startsWith("https://www.youtube.com") &&
      newChannel.endsWith("/videos")
    ) {
      setChannels([...channels, newChannel]);
      setUnsavedChannels([...unsavedChannels, newChannel]);
      setNewChannel("");
    } else {
      alert("Invalid channel URL");
    }
  };

  const handleDelete = (index: number) => {
    const newChannels = [...channels];
    newChannels.splice(index, 1);
    setChannels(newChannels);

    const newUnsavedChannels = [...unsavedChannels];
    if (newUnsavedChannels.includes(channels[index])) {
      newUnsavedChannels.splice(newUnsavedChannels.indexOf(channels[index]), 1);
    }
    setUnsavedChannels(newUnsavedChannels);
  };

  const handleSave = () => {
    if (token) {
      axios
        .post("/updatechannels", channels, {
          headers: {
            "x-access-token": token,
          },
        })
        .then((response) => {
          setUnsavedChannels([]);
          alert("Channels updated successfully");
        });
    }
  };

  return (
    <Card elevation={8} style={{ padding: "8px" }}>
      <Grid container spacing={2} style={{ marginBottom: "8px" }}>
        <Grid item xs={12}>
          <Card elevation={2}>
            <CardHeader title="Youtube Channels" align="center" />
            <List style={{ border: "1px solid #DDE" }}>
              {channels.map((channel, index) => (
                <ListItem
                  key={index}
                  style={
                    unsavedChannels.includes(channel)
                      ? { backgroundColor: "lightyellow" }
                      : { backgroundColor: index % 2 === 0 ? "white" : "#DDE" }
                  }
                >
                  <Grid
                    container
                    direction={isMobile ? "row" : "row"}
                    alignItems="center"
                    spacing={0}
                  >
                    <Grid item xs={11} sm={11}>
                      <ListItemText
                        primary={
                          <div
                            style={{
                              fontSize: isMobile ? "small" : "medium",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {channel}
                          </div>
                        }
                      />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={() => handleDelete(index)}
                          size={isMobile ? "small" : "medium"}
                        >
                          <Delete />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </Grid>
                  </Grid>
                </ListItem>
              ))}
            </List>
          </Card>
        </Grid>
        <Grid item xs={12}>
          <Card elevation={0} style={{ paddingTop: '8px'}}>
            <Tooltip
              placement="top"
              title="Enter a new channel URL to track here, eg: https://www.youtube.com/@PrestonReacts/videos"
            >
              <TextField
                label="New Channel"
                value={newChannel}
                onChange={(e) => setNewChannel(e.target.value)}
                fullWidth
                InputProps={{
                  style: { fontSize: isMobile ? "small" : "medium" },
                }}
              />
            </Tooltip>
          </Card>
        </Grid>
        <Grid item xs={6}>
          <Tooltip placement="top" title="Add a new channel to the list above">
            <Button
              variant="contained"
              onClick={handleAdd}
              fullWidth
              style={{ fontSize: isMobile ? "small" : "medium" }}
            >
              Add Channel
            </Button>
          </Tooltip>
        </Grid>
        <Grid item xs={6}>
          <Tooltip
            placement="top"
            title="Save your changes and make them active"
          >
            <Button
              variant="contained"
              onClick={handleSave}
              fullWidth
              style={{ fontSize: isMobile ? "small" : "medium" }}
            >
              Save Changes
            </Button>
          </Tooltip>
        </Grid>
      </Grid>
    </Card>
  );
}

export default ChannelManager;
