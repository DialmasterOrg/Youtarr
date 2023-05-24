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
  Dialog,
  DialogContentText,
  DialogContent,
  DialogActions,
} from "@mui/material";
import Delete from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
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
  const [deletedChannels, setDeletedChannels] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState("");

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  useEffect(() => {
    reloadChannels();
  }, [token]);

  const reloadChannels = () => {
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
  };

  const handleAdd = () => {
    if (
      newChannel.startsWith("https://www.youtube.com") &&
      newChannel.endsWith("/videos")
    ) {
      setChannels([...channels, newChannel]);
      setUnsavedChannels([...unsavedChannels, newChannel]);
    } else {
      setDialogMessage("Invalid channel URL");
      setIsDialogOpen(true);
    }
    setNewChannel("");
  };

  const handleDelete = (index: number) => {
    if (unsavedChannels.includes(channels[index])) {
      setUnsavedChannels(
        unsavedChannels.filter((channel) => channel !== channels[index])
      );
      setChannels(channels.filter((channel) => channel !== channels[index]));
    } else {
      setDeletedChannels([...deletedChannels, channels[index]]);
    }
  };

  const handleUndo = () => {
    setDeletedChannels([]);
    setUnsavedChannels([]);
    reloadChannels();
  };

  const handleSave = () => {
    if (token) {
      const channelsToSave = channels.filter(
        (channel) => !deletedChannels.includes(channel)
      );
      axios
        .post("/updatechannels", channelsToSave, {
          headers: {
            "x-access-token": token,
          },
        })
        .then((response) => {
          setDeletedChannels([]);
          setUnsavedChannels([]);
          setDialogMessage("Channels updated successfully");
          setIsDialogOpen(true);
          reloadChannels();
        });
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
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
                      ? { backgroundColor: "#b8ffef" }
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
                              fontWeight: unsavedChannels.includes(channel)
                                ? "bold"
                                : "normal",
                              textDecoration: deletedChannels.includes(channel)
                                ? "line-through"
                                : "none",
                              color: deletedChannels.includes(channel)
                                ? "red"
                                : "inherit",
                            }}
                          >
                            {channel}
                          </div>
                        }
                      />{" "}
                    </Grid>
                    {!deletedChannels.includes(channel) && (
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
                    )}
                  </Grid>
                </ListItem>
              ))}
            </List>
          </Card>
        </Grid>
        <Grid item xs={11}>
          <Card elevation={0} style={{ paddingTop: "8px" }}>
            <Tooltip
              placement="top"
              title="Enter a new channel URL to track here, eg: https://www.youtube.com/@PrestonReacts/videos"
            >
              <TextField
                label="New Channel"
                value={newChannel}
                onChange={(e) => setNewChannel(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleAdd();
                  }
                }}
                fullWidth
                InputProps={{
                  style: { fontSize: isMobile ? "small" : "medium" },
                }}
              />
            </Tooltip>
          </Card>
        </Grid>
        <Grid
          item
          xs={1}
          style={{
            paddingLeft: isMobile ? "8px" : "0px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Tooltip placement="top" title="Add a new channel to the list above">
            <IconButton onClick={handleAdd} color="primary">
              <AddIcon fontSize="large" />
            </IconButton>
          </Tooltip>
        </Grid>
        <Grid item xs={6}>
          <Tooltip placement="top" title="Revert unsaved changes">
            <Button
              variant="contained"
              onClick={handleUndo}
              fullWidth
              disabled={
                unsavedChannels.length === 0 && deletedChannels.length === 0
              }
              style={{ fontSize: isMobile ? "small" : "medium" }}
            >
              Undo
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
              disabled={
                unsavedChannels.length === 0 && deletedChannels.length === 0
              }
              onClick={handleSave}
              fullWidth
              style={{ fontSize: isMobile ? "small" : "medium" }}
            >
              Save Changes
            </Button>
          </Tooltip>
        </Grid>
      </Grid>

      <Dialog
        open={isDialogOpen}
        onClose={handleCloseDialog}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            {dialogMessage}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} color="primary" autoFocus>
            Close
          </Button>
        </DialogActions>
      </Dialog>

    </Card>
  );
}

export default ChannelManager;
