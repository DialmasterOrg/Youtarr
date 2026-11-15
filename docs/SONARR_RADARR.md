# Sonarr and Radarr

Youtarr can act as an indexer and a download client for Sonarr and Radarr. Sonarr or Radarr searches for an episode or a movie, Youtarr offers matching YouTube videos, a grab becomes a normal Youtarr download, and Sonarr or Radarr imports the finished file into its own library. The feature is off by default.

## Table of Contents
- [What to expect](#what-to-expect)
- [Before you start: the shared folder](#before-you-start-the-shared-folder)
- [Turn it on in Youtarr](#turn-it-on-in-youtarr)
- [Add Youtarr to Sonarr and Radarr](#add-youtarr-to-sonarr-and-radarr)
- [Settings to check in Sonarr and Radarr](#settings-to-check-in-sonarr-and-radarr)
- [How matching works](#how-matching-works)
- [Connecting your Sonarr and Radarr (optional)](#connecting-your-sonarr-and-radarr-optional)
- [Categories and a second instance](#categories-and-a-second-instance)
- [Recent grabs](#recent-grabs)
- [Login proxies](#login-proxies)
- [Troubleshooting](#troubleshooting)

## What to expect

- Youtarr answers a search by searching YouTube, so it finds what people uploaded to YouTube: older TV, public-domain films, and shows that are published on YouTube. It does not find scene releases.
- A grabbed video is downloaded by Youtarr like any other video and stays in Youtarr's library. Sonarr or Radarr gets its own copy of the file (a hardlink when both are on one filesystem), so removing a grab in Sonarr or Radarr never deletes Youtarr's copy.
- Grabs show up in Youtarr's Download History as **Sonarr/Radarr**, and in notifications like a manual download.
- Youtarr runs one download job at a time. A grab made during a large channel download waits behind it; Sonarr and Radarr show it as queued.
- Add Youtarr to Sonarr and Radarr directly. Adding it through Prowlarr is not supported yet.
- Anime searched by absolute episode number is not supported.

## Before you start: the shared folder

Sonarr and Radarr import a finished grab from a staging folder that Youtarr creates inside its downloads folder:

```
<your Youtarr downloads folder>/.arr-staging/<category>/<release name>/<release name>.mp4
```

Sonarr and Radarr must be able to read that folder and delete inside it.

1. **Mount the folder into Sonarr and Radarr.** The simplest setup mounts it at the same path Youtarr uses, `/usr/src/app/data/.arr-staging`. For example, in the Sonarr and Radarr containers:

   ```yaml
   volumes:
     - /path/to/your/youtube/downloads/.arr-staging:/usr/src/app/data/.arr-staging
   ```

2. **If you mount it at another path**, tell Youtarr: enter that path under **The same folder as Sonarr and Radarr see it** on the Settings page. A Remote Path Mapping in Sonarr and Radarr works too.
3. **Give Sonarr and Radarr write access.** Youtarr creates the staged folders as its own user, writable by its group. Run Sonarr and Radarr with the same user or group (`YOUTARR_UID` / `YOUTARR_GID` in Youtarr, `PUID` / `PGID` in most Sonarr and Radarr images).
4. **Keep it out of your library folders.** The staging folder must not sit inside a Sonarr or Radarr root folder.

**Note:** Sonarr and Radarr get their own hardlink only when the staging folder and their library are on the same filesystem. Across filesystems they copy the file instead, which takes the space twice.

Youtarr puts `.ignore` and `.plexignore` files in the staging folder, so Plex, Jellyfin and Emby skip it when they index your downloads folder.

## Turn it on in Youtarr

1. Open **Settings -> Sonarr / Radarr** and turn on **Enable the Sonarr / Radarr bridge**. The page now shows an **API key** and the values to enter in Sonarr and Radarr.
2. **Save**. The key and the values only start working once the setting is saved.

## Add Youtarr to Sonarr and Radarr

Do both steps in each app. The Settings page shows these values filled in for your address.

**The indexer** (Settings -> Indexers -> Add -> Newznab):

| Field | Value |
|---|---|
| URL | `http://<youtarr address>:<port>/arr/newznab` |
| API Path | `/api` |
| API Key | the key from the Youtarr Settings page |
| Categories | leave the defaults |

**The download client** (Settings -> Download Clients -> Add -> SABnzbd):

| Field | Value |
|---|---|
| Host | your Youtarr address |
| Port | your Youtarr port |
| URL Base | `/arr/sabnzbd` |
| API Key | the same key |
| Category | `tv` in Sonarr, `movies` in Radarr |

Leave the username and password empty. Press **Test** on both; both should pass.

**Note:** The address is the one Sonarr and Radarr reach Youtarr at. If they run in Docker on the same network as Youtarr, that is Youtarr's container name and port `3011`, not the address you open in your browser.

## Settings to check in Sonarr and Radarr

- **Quality profile.** Youtarr labels every release `WEB-DL` at the resolution it downloads at (the **Preferred Resolution** setting, 1080p by default). The profile of the series or movie must allow WEBDL at that resolution. Sonarr's default "Any" profile does not include 2160p. After import, Sonarr and Radarr read the real resolution from the file.
- **Delay profile.** Usenet must be enabled: Youtarr presents itself as a Usenet indexer.
- **Automatic search.** With the default strict matching you can leave "Enable Automatic Search" on. If you turn on loose matching in Youtarr, turn it off for the Youtarr indexer and search interactively.

## How matching works

Sonarr and Radarr decide what a release is from its name alone, so Youtarr only offers a video it is confident about and names the release after what was searched for.

**Strict matching (the default)**

- An episode is offered when the video's title has the series name and the episode, written like `S01E05`, `1x05` or `Season 1 Episode 5`.
- A movie is offered when the video's title has every word of the movie's name and its year.
- A search for a whole season is answered from one YouTube search, and each video offered still needs its own episode marker.

**Loose matching** accepts an episode number without a season and a movie without its year. It finds more and can offer the wrong video.

Both modes skip:

- videos whose title has one of the **excluded words** (trailer, clip, reaction, recap and so on; you can edit the list),
- videos shorter than the **shortest episode** or **shortest movie** length. Sonarr refuses to import an episode under 10 minutes for a series that runs longer than 30 minutes, which is why the default is 10,
- live and upcoming videos,
- a video whose grab failed in the last 7 days.

Good to know:

- Daily shows (searched by date) need a YouTube API key in **Settings -> YouTube API**, because only the API gives exact upload dates.
- With a YouTube API key, each new search costs 100 units of your daily quota. Results are remembered for 10 minutes.
- When Youtarr cannot search right now (YouTube is rate limiting it, for example), it waits up to 30 seconds and then answers with an error instead of "nothing found".

## Connecting your Sonarr and Radarr (optional)

Official channels often title an episode "Episode 29: Play It Again, Dizzi!" with no season. Strict matching cannot use that title by itself. If you connect Youtarr to your Sonarr, it reads the episode's title and runtime from Sonarr and can match such uploads.

On the Settings page, under **Connect to Sonarr and Radarr**, enter the app's address and its API key (in the app: Settings -> General -> API Key) and press **Test and save**. Youtarr asks the app who it is and saves the connection only when it answers.

What a connection adds:

- An episode is also found by its title, when the video's length fits the episode's runtime. A double episode, or a clip with the same title, is not offered.
- Short shows become searchable: the series' own runtime replaces the 10 minute minimum.
- For movies, the video's length must also fit the movie's runtime.

Things to know:

- The connection only reads. Youtarr never changes anything in Sonarr or Radarr through it.
- Use the app's direct address. **Test and save** tells you when an address redirects or answers with a login page, and saves nothing in that case.
- One Sonarr and one Radarr can be connected. A second instance (a 4K one) usually holds the same series, so the one connection serves its searches too.
- Daily shows, and anime that Sonarr searches by scene numbers, are still matched by episode number only.
- The shortest episode and movie lengths then only apply when the app does not know a runtime.
- Without a connection, or when the app cannot be reached, searches work as described under [How matching works](#how-matching-works).

## Categories and a second instance

A category is the name a Sonarr or Radarr instance gives its download client, and Youtarr uses it to keep instances apart. The defaults are `tv` and `movies`.

- For each category you can choose where Youtarr downloads its videos (a subfolder, or your normal download settings).
- If you run two instances of the same app (a 1080p Sonarr and a 4K Sonarr), give the second one its own category, for example `tv-4k`: add it in Youtarr, save, and enter it as the Category of that instance's download client. Two instances that share a category import each other's downloads.

## Recent grabs

The bottom of the Settings page lists the newest grabs:

| State | Meaning |
|---|---|
| Waiting to download | Youtarr has the grab and will queue the download. |
| Downloading | The download is queued or running in Youtarr. |
| Ready to import | The file is in the staging folder, waiting for Sonarr or Radarr. If it stays here, the app's queue says why. |
| Taken by Sonarr/Radarr | The app took the file: it imported it, or the item was removed in the app. Youtarr cannot tell the two apart. |
| Failed | The download failed; the reason is shown. Sonarr or Radarr blocklists the release and searches again. |
| Removed before it finished | The item was removed in the app before the download ended. The video still finishes downloading into Youtarr. |

A staged file that nobody imports is removed after 7 days (**Keep staged files for**). Your library copy stays.

## Login proxies

Sonarr and Radarr cannot log in to Youtarr, so the `/arr/` path is protected by the API key instead of your Youtarr login. If you run Youtarr behind a login proxy such as Authelia or Cloudflare Access, add an exception for `/arr/`. See [the API key instructions](API_INTEGRATION.md#cors-error--blocked-by-external-auth-cloudflare-zero-trust-authelia-etc) for how to add one, using `/arr/` as the path.

The exception is safe: Youtarr checks the key on every `/arr/` request, also with `AUTH_ENABLED=false`, and the path answers "not found" while the bridge is off.

**Keep the key private.** Anyone with it can search and start downloads. If it gets out, press **Create new key** and update the indexer and the download client in Sonarr and Radarr.

## Troubleshooting

**"All indexers are unavailable due to failures"**

Youtarr answered a search with an error, and Sonarr or Radarr paused the indexer for a few minutes. This happens when YouTube searches fail or pile up. Wait, then press Test on the indexer. If the address or key was wrong, fix it and Test again.

**The indexer Test fails with "Invalid API Key", or the download client with "API Key Incorrect"**

The key in Sonarr or Radarr is not the one on the Youtarr Settings page. Copy it again; if you pressed **Create new key**, the old one stopped working.

**The Test cannot connect at all, or reports "not found"**

The bridge is off, or it was switched on but not saved yet: Youtarr answers "not found" on every `/arr/` path until the setting is saved. Otherwise the address or port is not the one Sonarr or Radarr reach Youtarr at.

**A search finds nothing for an episode you know is on YouTube**

Its title probably has no season and episode marker. Connect your Sonarr (see above), or turn on loose matching and search interactively.

**"Unknown Series" in Sonarr's log**

Sonarr could not match the release name to a series. This is expected for the one placeholder release Youtarr lists so that the indexer Test passes; it is never grabbed. For a real release, the series must be in your library under the name that was searched.

**"WEBDL-2160p is not wanted in profile"**

The quality profile does not allow the resolution Youtarr downloads at. Allow it in the profile, or lower Youtarr's Preferred Resolution.

**The import waits with "Sample"**

The video is shorter than Sonarr's or Radarr's minimum for that series or movie. Import it by hand in the app's queue, or remove it.

**A health error about a missing download folder**

The app cannot see the staging folder. Check the mount from [Before you start](#before-you-start-the-shared-folder).

**The import fails with a permission error, or the staged folder is left behind**

The app cannot delete inside the staging folder. Run it with the same user or group as Youtarr.

**The import copies the file instead of linking it**

The staging folder and the app's library are on different filesystems.

**A grab fails right away**

The reason is in the Recent grabs list. Common ones: the video is members-only or was removed, or Youtarr is set to download audio only.
