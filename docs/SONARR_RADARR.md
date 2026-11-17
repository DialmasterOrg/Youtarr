# Sonarr and Radarr

Youtarr can act as an indexer and a download client for Sonarr and Radarr. Sonarr or Radarr searches for an episode or a movie, Youtarr offers matching YouTube videos, a grab becomes a normal Youtarr download, and Sonarr or Radarr imports the finished file into its own library. The feature is off by default.

## Table of Contents
- [What to expect](#what-to-expect)
- [Step 1: Turn it on](#step-1-turn-it-on)
- [Step 2: Add Youtarr to Sonarr and Radarr](#step-2-add-youtarr-to-sonarr-and-radarr)
- [Step 3: Connect your Sonarr and Radarr (recommended)](#step-3-connect-your-sonarr-and-radarr-recommended)
- [Step 4: The shared folder](#step-4-the-shared-folder)
- [Settings to check in Sonarr and Radarr](#settings-to-check-in-sonarr-and-radarr)
- [How matching works](#how-matching-works)
- [Resolution](#resolution)
- [Using Youtarr beside other indexers](#using-youtarr-beside-other-indexers)
- [Removing Youtarr's copy after the import](#removing-youtarrs-copy-after-the-import)
- [Keeping grabs apart from the rest of Youtarr](#keeping-grabs-apart-from-the-rest-of-youtarr)
- [Categories and a second instance](#categories-and-a-second-instance)
- [Recent grabs](#recent-grabs)
- [Recent searches](#recent-searches)
- [Login proxies](#login-proxies)
- [Troubleshooting](#troubleshooting)

## What to expect

- Youtarr answers a search by searching YouTube, so it finds what people uploaded to YouTube: older TV, public-domain films, and shows that are published on YouTube. It does not find scene releases.
- A grab is a one-off download, separate from your subscriptions. Youtarr does not subscribe to the channel or download anything else from it, and nothing is added to your Channels page.
- A grabbed video is downloaded by Youtarr like any other video and stays in Youtarr's library. Sonarr or Radarr gets its own copy of the file, so removing a grab in Sonarr or Radarr never deletes Youtarr's copy. Whether that copy takes extra space depends on your folders; see [Step 4](#step-4-the-shared-folder). If you would rather not keep Youtarr's copy, see [Removing Youtarr's copy after the import](#removing-youtarrs-copy-after-the-import).
- A video Youtarr already has is handed over as it is. It is not downloaded again, Sonarr or Radarr gets the existing file at the quality it has, and Youtarr never removes it.
- Grabs show up in Youtarr's Download History as **Sonarr/Radarr**, on the Videos page under the channel that uploaded them, and in notifications like a manual download. To keep them out of sight, see [Keeping grabs apart from the rest of Youtarr](#keeping-grabs-apart-from-the-rest-of-youtarr).
- Youtarr only answers searches. It does not announce new uploads, so Sonarr's and Radarr's RSS sync never finds anything here. A new episode is found when a search runs: one you start, a request from Seerr, or the search Sonarr runs when you add a series.
- Youtarr runs one download job at a time. A grab made during a large channel download waits behind it; Sonarr and Radarr show it as queued.
- The indexer can also be added through Prowlarr; see [Using Prowlarr](#using-prowlarr). The download client is always added in Sonarr and Radarr themselves.
- Anime searched by absolute episode number is not supported.

The Settings page (**Settings -> Sonarr / Radarr**) walks through the same four steps as this guide.

## Step 1: Turn it on

1. Open **Settings -> Sonarr / Radarr** and turn on **Enable the Sonarr / Radarr bridge**. The page now shows the remaining steps.
2. **Save**. The key and the values in step 2 only start working once the setting is saved.

## Step 2: Add Youtarr to Sonarr and Radarr

Add both an indexer and a download client in each app. The Settings page shows these values filled in. It asks **Where do Sonarr and Radarr run?** because that decides the address:

- **In Docker, on the same network as Youtarr:** Youtarr's container name (`youtarr` unless you renamed it) and port `3011`, the port Youtarr listens on inside Docker whatever port you publish.
- **Somewhere else:** the address you open Youtarr at in your browser. `localhost` only works when Sonarr and Radarr run on the same machine, outside Docker.

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

### Using Prowlarr

If Prowlarr manages your indexers, add Youtarr there instead of in each app: Indexers -> Add Indexer -> **Generic Newznab**, with the same URL, API Path and API Key as in the table above. Prowlarr then syncs it to Sonarr and Radarr as "Youtarr (Prowlarr)". Add the download client in Sonarr and Radarr as described above; Prowlarr does not sync download clients.

Prowlarr does not pass a series' full name on, so episodes found through it are named like `Office.AKA.The.Office.S01E02.1080p.YT.WEB-DL-Channel`. Sonarr matches that name to the series with or without the leading "The". With renaming turned off in Sonarr, the imported file keeps that name.

Prowlarr's own Search page gets results from Youtarr for an episode, a season or a movie, not for plain text:

- **An episode:** under Query Options choose **TV Search**, and put the season and episode in the text: `Beverly Hillbillies {Season:1} {Episode:5}`. With `{Season:1}` alone you get that season's episodes.
- **A movie:** choose a **Movies** category and end the text with the year: `Plan 9 from Outer Space 1957`. `{Year:1957}` does not work: Prowlarr does not pass it on.
- **Anything else finds nothing**, for example a title alone, or `Beverly Hillbillies S01E05` typed as plain text.

The [Recent searches](#recent-searches) list shows what Prowlarr sent and why a request was not searched.

## Step 3: Connect your Sonarr and Radarr (recommended)

Official channels often title an episode "Episode 29: Play It Again, Dizzi!" with no season. Strict matching cannot use that title by itself, so without a connection most official uploads are not found. If you connect Youtarr to your Sonarr, it reads the episode's title and runtime from Sonarr and can match such uploads.

Under **Step 3** on the Settings page, enter the app's address and its API key (in the app: Settings -> General -> API Key) and press **Test and save**. Youtarr asks the app who it is, then asks it to look up one title, and saves the connection only when both work.

What a connection adds:

- An episode is also found by its title, when the video's length fits the episode's runtime. A double episode, or a clip with the same title, is not offered.
- When a channel named after the series has the episode, only its upload is offered. Copies uploaded by other channels are offered when it has none, or after its download failed. Loose matching offers them all.
- Short shows become searchable: the series' own runtime replaces the 10 minute minimum.
- For movies, the video's length must also fit the movie's runtime.
- Youtarr can check the shared folder for you (step 4).
- [Remove after import](#removing-youtarrs-copy-after-the-import) works: Youtarr asks the app whether it imported a grab before deleting its own copy.

Things to know:

- The connection only reads. Youtarr never changes anything in Sonarr or Radarr through it.
- The connection works at any library size. To tie a search to a series, Youtarr asks the app to read the release name it is about to offer, which takes a few milliseconds even with thousands of series. It never reads your whole library for that.
- **Test and save** fails with "could not look up a title" when the app answers but cannot do that lookup. Check that the address points at Sonarr or Radarr itself, and update the app if it is old.
- With a very large Sonarr library, the check that keeps out videos of a similarly named series (a video named "Beyblade Burst" is not offered for "Beyblade") may be off. Youtarr reads the list of all series for it in the background, and a very large library can take too long. The log says so, and Youtarr tries again an hour later. Searches are not held up by it.
- Use the app's direct address. **Test and save** tells you when an address redirects or answers with a login page, and saves nothing in that case.
- One Sonarr and one Radarr can be connected. A second instance (a 4K one) usually holds the same series, so the one connection serves its searches too.
- Daily shows, and anime that Sonarr searches by scene numbers, are still matched by episode number only.
- The shortest episode and movie lengths then only apply when the app does not know a runtime.
- Without a connection, or when the app cannot be reached, searches work as described under [How matching works](#how-matching-works).

## Step 4: The shared folder

Sonarr and Radarr import a finished grab from a staging folder that Youtarr creates inside your downloads folder:

```
<your downloads folder>/.arr-staging/<category>/<release name>/<release name>.mp4
```

They must be able to see that folder and delete inside it, the same way they see the folder of any other download client. Nothing about Youtarr's own container needs to change.

**The Settings page checks this for you.** With a connection from step 3, Youtarr asks Sonarr and Radarr whether they see the folder, and step 4 on the page shows the answer for each app. If an app can see it, there is nothing to do.

If an app cannot see it, there are two ways to fix it:

- **Sonarr or Radarr already has your downloads folder mounted, under another path.** This is common when one media folder is shared with every container. Open **Sonarr and Radarr see this folder under a different path** on the page, enter the folder's path inside Sonarr and Radarr (for example `/data/youtube/.arr-staging`) and save. A Remote Path Mapping in Sonarr and Radarr works too, but the page's check cannot follow one.
- **Sonarr or Radarr cannot reach your downloads folder at all.** Add the staging folder to their volumes, at the same path Youtarr uses:

  ```yaml
  volumes:
    - /path/to/your/youtube/downloads/.arr-staging:/usr/src/app/data/.arr-staging
  ```

Also:

- **Give Sonarr and Radarr write access.** Youtarr creates the staged folders as its own user, writable by its group. Run Sonarr and Radarr with the same user or group (`YOUTARR_UID` / `YOUTARR_GID` in Youtarr, `PUID` / `PGID` in most Sonarr and Radarr images).
- **Keep it out of your library folders.** The staging folder must not sit inside a Sonarr or Radarr root folder.

**Note:** Sonarr and Radarr move the staged file into their library. The video takes no extra space only when the staging folder and their library are inside one volume of their container, for example one media folder that is mounted as a whole and holds both. With the staging folder as a volume of its own, as in the example above, or with the library on another disk, the move becomes a copy, and the video takes its space twice for as long as Youtarr keeps its copy. That is how Docker works, also when both folders are on the same disk. [Removing Youtarr's copy after the import](#removing-youtarrs-copy-after-the-import) frees that space.

Youtarr puts `.ignore` and `.plexignore` files in the staging folder, so Plex, Jellyfin and Emby skip it when they index your downloads folder.

## Settings to check in Sonarr and Radarr

- **Quality profile.** Youtarr labels each release `WEB-DL` at the resolution the video really has, up to the lower of **Resolution** and **Offer releases as** on the Sonarr / Radarr page (see [Resolution](#resolution)). The profile of the series or movie must allow WEBDL at the resolution a video really has, up to that one: a video that only exists in 480p is offered as 480p, and a profile that does not allow 480p will not take it. Sonarr's default "Any" profile does not include 2160p.
- **Delay profile.** Usenet must be enabled: Youtarr presents itself as a Usenet indexer.
- **Automatic search.** With the default strict matching you can leave "Enable Automatic Search" on; [How matching works](#how-matching-works) names the cases it can still get wrong. If you turn on loose matching in Youtarr, turn it off for the Youtarr indexer and search interactively.

## How matching works

Sonarr and Radarr decide what a release is from its name alone, so Youtarr only offers a video it is confident about and names the release after what was searched for.

**Strict matching (the default)**

- An episode is offered when the video's title has the series name and the episode, written like `S01E05`, `1x05` or `Season 1 Episode 5`.
- A movie is offered when the video's title has every word of the movie's name and its year.
- A search for a whole season is answered from one YouTube search for each name of the series, and each video offered still needs its own episode marker.

**Loose matching** accepts an episode number without a season and a movie without its year. It finds more and can offer the wrong video.

**Strict matching is careful, not certain.** Two cases are known to get through:

- **Two shows with the same name.** A search for the first episode of The Office (US) can be answered with the first episode of the British series: both are "The Office", season 1, episode 1, and about as long. For a show that shares its name with another, search interactively, or check its first grabs.
- **Without a connection, a title that has the episode marker and then the series' words.** "Age Of Conan - S01E10 : Mission Impossible" is offered for Mission: Impossible S01E10. With a [connection](#step-3-connect-your-sonarr-and-radarr-recommended), the episode's runtime keeps out a video of another length.

Both modes skip:

- videos whose title has one of the **excluded words** (trailer, clip, reaction, recap and so on; you can edit the list),
- videos shorter than the **shortest episode** or **shortest movie** length. Sonarr refuses to import an episode under 10 minutes for a series that runs longer than 30 minutes, which is why the default is 10,
- live and upcoming videos,
- a video whose grab failed in the last 7 days.

Good to know:

- When several videos match, an automatic search lets Sonarr or Radarr choose, and a newer upload usually wins. Search interactively to choose yourself: each release links to its YouTube page and is named after the channel that uploaded it.
- A search for a whole season finds nothing when the season is numbered by year (`Season 2024`), which is how TheTVDB lists most shows made for YouTube. Sonarr searches by season whenever a season has more than one wanted episode, so for such a show search the episodes one at a time.
- Daily shows (searched by date) need a YouTube API key in **Settings -> YouTube API**, because only the API gives exact upload dates. For the same reason they are not held to the daily share described below.
- With a YouTube API key, one YouTube search costs about 100 to 200 units of your daily quota: 100 for each page of results, plus 1 to read the videos' lengths. A second page is needed when the first has too few usable results. Results are remembered for 10 minutes, so repeating a search in that time costs nothing.
- One search in Sonarr or Radarr can be several YouTube searches. Sonarr asks once per name of a series (its title and each alias), and a search for whole seasons asks once per season. With a [Sonarr connection](#step-3-connect-your-sonarr-and-radarr-recommended), an episode found by its title costs one YouTube search for all names together. A Radarr search of many movies is at least one YouTube search per movie.
- Searches from Sonarr and Radarr may use at most 5,000 units a day, half of Google's default daily quota of 10,000. After that they use yt-dlp until the quota resets at midnight Pacific time. The rest of Youtarr (Find Videos, channel search and so on) keeps using the API. Youtarr counts this itself, in memory, so a restart starts the count again.
- When the whole daily quota is used up, by anything, everything in Youtarr uses yt-dlp until midnight Pacific time, and searches for daily shows find nothing in that time. The log has a line for it: "Sonarr/Radarr daily search skipped: the YouTube API is not available".
- Without a YouTube API key none of this applies: every search uses yt-dlp.
- When Youtarr cannot search right now (YouTube is rate limiting it, for example), it waits up to 30 seconds and then answers with an error instead of "nothing found".

## Resolution

Two settings under **Downloads** on the Sonarr / Radarr settings page decide the resolution of a grab and of the release Youtarr offers.

**Resolution** is the resolution a grab is downloaded at:

- **Same as Preferred Resolution** (the default) uses the resolution of your other downloads, from Settings -> Core.
- **2160p, 1080p, 720p or 480p** applies to grabs only. These are the resolutions Sonarr and Radarr have a quality for.

**Offer releases as** is the highest resolution a release is labeled with:

- **Their real resolution** (the default) labels each release with the video's real resolution.
- **1080p at most, 720p at most or 480p at most** lowers the label, so Sonarr and Radarr pick Youtarr only when nothing better is offered. See [Using Youtarr beside other indexers](#using-youtarr-beside-other-indexers).

**The label is the video's real resolution**, never more than **Resolution** and never more than **Offer releases as**. With Resolution at 1080p, a video that exists in 2160p is offered as 1080p, and a video that only exists in 480p is offered as 480p. Youtarr finds the real resolution in this order:

1. A video that is already in your Youtarr library: the resolution of its file.
2. With a YouTube API key (**Settings -> YouTube API**): YouTube says whether a video is in high definition. A video that is not is labeled 480p. When the label cannot be higher than 720p anyway (**Resolution** or **Offer releases as** is 720p), a high-definition video is labeled 720p.
3. An answer Youtarr found in the last 6 hours.
4. Otherwise Youtarr asks yt-dlp about each video it is about to offer, without your cookies. It checks 2 videos at a time and at most 10 for each request Sonarr or Radarr sends, and stops after about 20 seconds, so a request can take that much longer. After 3 checks in a row get no answer (a YouTube bot check, for example), it stops checking for 15 minutes. It also makes at most 100 of these checks an hour; past that, a video is labeled as described below until the hour has passed.

A video whose real resolution Youtarr could not read is labeled with **Resolution**, or with **Offer releases as** when that is lower. When either setting is 480p, every release is labeled 480p and nothing is checked.

Things to know:

- A grab is downloaded at **Resolution** as it is set when the download starts, whatever the release name says.
- The resolution is a ceiling, not a promise. Youtarr downloads the best quality up to it, so a video that only exists in 480p downloads in 480p. Sonarr and Radarr read the real resolution from the file when they import it, and show that. A release labeled lower than its file (labeled 480p, the file is 1080p) is imported as 1080p.
- A video that is already in your Youtarr library is handed over as it is. It is not downloaded again at this resolution.
- The grabbed video stays in your Youtarr library at this resolution, also when your Preferred Resolution is different.

## Using Youtarr beside other indexers

When Sonarr or Radarr also use other indexers, they compare Youtarr's releases with everything else they find. Every Youtarr release carries `YT` before `WEB-DL` in its name, for example `Show.S01E05.1080p.YT.WEB-DL-Channel`, where `Channel` is the YouTube channel that uploaded the video.

**What Sonarr and Radarr do by themselves.** They choose a release by quality first, then by custom format score, and only then by the indexer's priority. A Youtarr release labeled 1080p competes with a 1080p WEB-DL from another indexer as an equal, and beats a 720p one. At import they read the real resolution from the file, and they refuse to replace a file you already have with one of lower quality ("Not an upgrade"). So a Youtarr grab does not replace a copy they rank as equal or better. One they rank higher does, when the profile allows upgrades: a video that really is 1080p replaces a 720p copy, wherever that copy came from.

To keep Youtarr for what other indexers do not have, use one or more of these:

- **Tags.** Give the Youtarr indexer a tag, in its settings under Settings -> Indexers. An indexer with a tag is only used for series or movies that carry one of its tags, so tag the series and movies that are only on YouTube.
- **Interactive search only.** Turn off **Enable Automatic Search** on the Youtarr indexer. Sonarr and Radarr then use it only in an interactive search, where you choose the release yourself.
- **Indexer priority only breaks ties.** Sonarr and Radarr compare quality and custom format score first. A higher **Indexer Priority** number (in the indexer's advanced settings: 1 to 50, lower is preferred, 25 by default) does not by itself stop a 1080p Youtarr release from beating a 720p release elsewhere.

**The last resort: a lower label and the lowest priority.** Set **Offer releases as** to **480p at most** in Youtarr, and the Youtarr indexer's **Indexer Priority** to 50 in Sonarr and Radarr. A Youtarr release then loses to any release of a higher quality, and the priority puts it behind other indexers when releases tie. Sonarr and Radarr grab from Youtarr only when nothing better is offered. The video is still downloaded at **Resolution**, and the app records the file's real quality at import. The quality profile must allow WEBDL-480p, or every Youtarr release is rejected.

**A custom format.** For finer control, add a custom format that matches Youtarr's releases (Settings -> Custom Formats -> add one), with a **Release Title** condition and this regular expression:

```
\bYT[ ._-]WEB[ ._-]?DL\b
```

Then give it a score in the quality profiles that use Youtarr (Settings -> Profiles, under Custom Formats):

- **A negative score** makes a release of the same quality from another indexer win over Youtarr's, and later replace a copy Youtarr already delivered, when the profile allows upgrades.
- **A total below the profile's minimum.** A release whose custom format scores add up to less than the profile's **Minimum Custom Format Score** is rejected, so a large negative score blocks Youtarr's releases for that profile.
- **A score never beats a higher quality.** A 1080p Youtarr release still wins over a 720p release elsewhere, whatever its score. Use **Offer releases as** for that.

## Removing Youtarr's copy after the import

By default a grabbed video stays in your Youtarr library as well as in Sonarr's or Radarr's. To keep it only there, turn on **Remove a video from Youtarr after Sonarr or Radarr imports it** under **Downloads** on the Settings page.

**This needs the connection from [step 3](#step-3-connect-your-sonarr-and-radarr-recommended).** Sonarr and Radarr tell Youtarr the same thing after an import and after you remove an item from their queue, so Youtarr asks the app itself whether it imported the grab, and deletes its own copy only when the app says it did.

Things to know:

- **A video whose import is not confirmed is kept.** The Recent grabs list says so. That is every video grabbed by an app that is not connected: the Settings page warns you when the setting is on and Sonarr or Radarr has no connection.
- One Sonarr and one Radarr can be connected. A video grabbed by a second instance is kept, because Youtarr cannot ask that instance.
- When the app cannot be reached, Youtarr asks again for up to a day, then keeps the video.
- Only a video Youtarr downloaded for the grab is removed. A video that was already in your library, from a channel you follow for example, always stays.
- The video is deleted like any video Youtarr's automatic cleanup removes: the Videos page shows it as deleted, with "after Sonarr imported it" as the reason, and Youtarr does not download it again by itself. A later grab of the same video downloads it again.
- Between the download and the import the video is in your Youtarr library, so a media server that indexes it can show it for a short while.
- The copy is removed when the app takes the item out of its download client history, which Sonarr and Radarr do right after an import while **Remove Completed** is on in their download client settings (the default). With it off, the copy is removed when the staged file's retention ends.
- Turning the setting on does not touch videos from earlier grabs.

## Keeping grabs apart from the rest of Youtarr

A grab is an ordinary Youtarr download, so it appears where downloads appear. This is where, and what keeps it out:

| Where | What you see | To keep it out |
|---|---|---|
| Download History | A row labeled **Sonarr/Radarr** | Tick **Hide Sonarr/Radarr grabs** above the list. The box appears once the list has a grab, and the choice is remembered in that browser. |
| Videos page | The video, under the channel that uploaded it | Turn on [remove after import](#removing-youtarrs-copy-after-the-import). A removed video counts as deleted, and the page hides deleted videos unless you ask for them. |
| Channels page | Nothing. A grab never adds a channel. | |
| Your media server | The file is in Youtarr's download location, so a media server that indexes it shows the video there as well as in the Sonarr or Radarr library | Choose a subfolder for the category under **Downloads** on the Settings page and leave that folder out of your media server's libraries, or turn on remove after import. |
| Downloads RSS feed | The video, like any download | Remove after import takes it out of the feed again. |
| Notifications | A notification like the one for a manual download | |

Good to know:

- A grab that stays in Youtarr follows your automatic removal rules like any other video.
- With remove after import on, the Download History row stays, and the video is listed among the deleted videos until you empty the trash (**Settings -> Maintenance & Rescan**).
- A grab that had to be tried again shows a second row, **Auto-retry**. The box hides that row too.

## Categories and a second instance

A category is the name a Sonarr or Radarr instance gives its download client, and Youtarr uses it to keep instances apart. The defaults are `tv` and `movies`.

- Under **Downloads** on the Settings page you choose where TV and movie grabs are saved: a subfolder, or Youtarr's normal download location.
- If you run two instances of the same app (a 1080p Sonarr and a 4K Sonarr), give the second one its own category, for example `tv-4k`: open **I run more than one Sonarr or Radarr** under Downloads, add the category, save, and enter it as the Category of that instance's download client. Two instances that share a category import each other's downloads.

## Recent grabs

Near the bottom, the Settings page lists the newest grabs, ten at first:

| State | Meaning |
|---|---|
| Waiting to download | Youtarr has the grab and will queue the download. A grab also waits here when Youtarr could not start its download or could not put the file in the staging folder: it tries again every 15 minutes, and the grab only fails after a day of that. |
| Downloading | The download is queued or running in Youtarr. |
| Ready to import | The file is in the staging folder, waiting for Sonarr or Radarr. If it stays here, the app's queue says why. |
| Taken by Sonarr/Radarr | The app took the file: it imported it, or the item was removed in the app. Youtarr cannot tell the two apart from this alone. With [remove after import](#removing-youtarrs-copy-after-the-import) on, the row also says whether Youtarr removed its own copy or kept it. |
| Failed | The download failed; the reason is shown. Sonarr or Radarr blocklists the release and searches again. |
| Removed before it finished | The item was removed in the app before the download ended. The video still finishes downloading into Youtarr. |

A staged file that nobody imports is removed after 7 days (**Remove files nobody imported after**, in step 4). Your library copy stays.

## Recent searches

Below the recent grabs, the Settings page lists the last 50 searches Sonarr and Radarr sent, ten at first. This is where to look when a search finds nothing, or offers a video you did not expect. Each row shows what was asked for, when, and the answer:

| Answer | Meaning |
|---|---|
| 3 offered | Youtarr offered that many videos. What Sonarr or Radarr did with them shows in the app's own search results. |
| Nothing offered | Youtarr searched YouTube, and no video passed. Open the row to see why. |
| Not searched | The request is one Youtarr does not search for. The row says why: a TV search without a season, a movie without its year, a daily show without a YouTube API key, and so on. |
| Could not search | The YouTube search failed or waited too long, and the app was told so. |

**Show results** opens a row. It lists each YouTube search Youtarr ran for the request, with the text it searched for and how many videos came back. An episode can have two: by the episode's title (with a [connection](#step-3-connect-your-sonarr-and-radarr-recommended)), then by season and episode when the first offers nothing. When an episode was not searched by its title, the row says why.

Under each search is every video YouTube returned, with its channel and length. An offered video shows the release name it was offered under. Every other video shows the first rule it failed:

| Reason | Meaning |
|---|---|
| An excluded word is in the title | One of your excluded words (trailer, review and so on). |
| Its length is not known | YouTube gave no length, and strict matching does not guess. |
| Shorter than the shortest length allowed | Under the shortest episode or movie length. Applies when the app reports no runtime. |
| Its length does not fit the runtime | Too short or too long for the runtime Sonarr or Radarr reports. |
| The series or movie name is not in the title | A word of the name is missing. For a search by episode title, the name may also be in the channel's name. |
| No season and episode in the title | Nothing like `S01E05`, `1x05` or `Season 1 Episode 5`. |
| The title names another episode or season | It has a marker, for another episode. |
| The title names several episodes | A range or a list, such as `S01E01-E03`. |
| The title names another series | Other words sit between the name and the episode ("Beyblade Metal Fusion S01E29"), it names a similarly named series in your library, or it carries a year from before the series began. |
| The episode's title is not in the title | For a search by episode title. |
| The title also has another episode's title | Two episodes in one video. |
| A one-word episode title also needs the episode number | A title like "Pilot" appears in unrelated videos. |
| Not uploaded on the air date | For a daily show: the upload is more than a day from the air date. |
| The movie's year is not in the title | Strict matching needs it. |
| Its grab failed in the last 7 days | It is offered again after that. |
| A channel closer to the series has this episode | Only the upload of the channel named after the series is offered. |
| Another video already has this release name | Two videos from one channel would get the same name. The first is offered. |
| Over the number of results the request asked for | The app asked for fewer results than passed. |
| No release name could be built | The name asked for has nothing a release name can be made of. |

Good to know:

- Sonarr sends one request for each name of a series, so one search in Sonarr can be several rows.
- Sonarr and Radarr also ask for "the newest releases" on every RSS sync and on the indexer Test. Youtarr answers those with a placeholder. They share one row for TV and one for movies, with a count.
- Live and upcoming videos are dropped before the list is made, so they do not appear.
- The list is kept in memory. A restart of Youtarr empties it, and it never holds your key.
- The list does not update by itself. Press **Refresh** after a search.

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

Its title probably has no season and episode marker. Connect your Sonarr ([step 3](#step-3-connect-your-sonarr-and-radarr-recommended)), or turn on loose matching and search interactively.

To see what happened, open the search under [Recent searches](#recent-searches) on the Settings page: it shows the text Youtarr searched YouTube for, every video that came back, and why each one was not offered.

**A search finds nothing for a movie you know is on YouTube**

Strict matching needs the movie's year, as Radarr lists it, in the video's title. Many uploads carry no year or another one: Radarr lists Plan 9 from Outer Space as 1957, and many uploads say 1958 or 1959. YouTube also does not return the same videos for the same search every time, so a search that found the movie once can find nothing the next time. Search again later, or turn on loose matching and search interactively: it accepts a title without the year. The [Recent searches](#recent-searches) list shows which videos came back and why each was not offered.

**"Unknown Series" in Sonarr's log**

Sonarr could not match the release name to a series. This is expected for the one placeholder release Youtarr lists so that the indexer Test passes; it is never grabbed. For a real release, the series must be in your library under the name that was searched.

**"WEBDL-2160p is not wanted in profile"**

The quality profile does not allow the resolution Youtarr labels its releases with. Allow it in the profile, or choose a lower [Resolution](#resolution) in Youtarr.

**"WEBDL-480p is not wanted in profile"**

The quality profile does not allow 480p. Youtarr labels a release 480p when **Offer releases as** is set to **480p at most**, and when the video only exists in 480p. Allow WEBDL-480p in the profile, or set **Offer releases as** higher (see [Resolution](#resolution)).

**The import waits with "Sample"**

The video is shorter than Sonarr's or Radarr's minimum for that series or movie. Import it by hand in the app's queue, or remove it.

**A health error about a missing download folder**

The app cannot see the staging folder. Step 4 on the Settings page shows which app, and [Step 4: The shared folder](#step-4-the-shared-folder) has the two ways to fix it.

**The import fails with a permission error, or the staged folder is left behind**

The app cannot delete inside the staging folder. Run it with the same user or group as Youtarr.

**The import copies the file instead of linking it**

The staging folder and the app's library are not inside one volume of the app's container, or they are on different disks. See the note under [Step 4: The shared folder](#step-4-the-shared-folder).

**A grab fails right away**

The reason is in the Recent grabs list. Common ones: the video is members-only or was removed, or Youtarr is set to download audio only.
