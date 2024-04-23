# Youtarr

## Description

Youtarr is a Dockerized application that offers a user-friendly way to automatically download videos from YouTube channels that you've handpicked, and integrates them seamlessly into your Plex Media Server.
Note that this is in no way endorsed by, or associated with Youtube or the Plex team.

## Overview

In the era of digital media, ensuring safe and appropriate content for your children can be a challenge. Youtube, while being a vast reservoir of educational and entertaining content, also hosts content that might not be suitable for children. To strike a balance, Youtarr allows you to curate YouTube channels so that you can provide a vetted, customized and safe YouTube experience for your kids via Plex.

The application operates by running a scheduled task that automatically downloads new videos, along with their thumbnails and metadata, from a list of YouTube channels that you specify. These videos are then automatically added to your Plex server and a library scan is initiated as soon as downloads are complete.

## NOTE: Work in progress.

In its current state, this application fulfills its intended functions and I anticipate it will prove beneficial for users with similar requirements. However, it's important to note that it remains a work-in-progress and not a completely refined product.

I openly invite any constructive feedback or suggestions for improvement. The journey of its development will continue, with the aim of introducing additional functionalities as the project evolves.

While the initial setup and startup process has been designed with a developer-friendly approach, it may not provide an equally seamless experience for the end user. I acknowledge this limitation and plan to address it in future updates, contingent upon user demand and interest.

Your engagement and feedback play a crucial role in shaping the future of this application. I look forward to continuously improving its functionality, usability, and overall user experience based on your needs and suggestions.

## Requirements

**This is designed to be run from the same computer that is running your Plex server as it needs direct access to write video files to the directory that you use for your Plex Youtube library**

To use Youtarr, you need to have the following software installed on your system:

1. **Docker:** Youtarr uses Docker to create an isolated environment where it can run without interfering with your system or requiring you to install a bunch of software. You can download Docker from the official website.

2. **Bash Shell:** Bash is a Unix shell and command language. The setup and start scripts are written in bash. For Windows users, you can use Git Bash, which is included when you install Git for Windows.

3. **Git**: Git is a free and open source distributed version control system designed to handle everything from small to very large projects with speed and efficiency. Git is needed to checkout/download this repository.

4. **npm (Node Package Manager -- NOT REQUIRED FOR END USERS):** npm is a package manager for the JavaScript programming language. It is used to install the dependencies that Youtarr needs to run in development mode. If you have Node.js installed on your machine, npm is typically installed with it. If not, you can download Node.js (which includes npm) from the official website

Please ensure that you have these installed and available in your system's PATH before you proceed with the installation of Youtarr.

## Key Features

- **Parental Control**: Vet the channels and control the quality and appropriateness of the content available to your children.
- **Ad-free Experience**: Running the content through a Plex server eliminates ads and potential exposure to inappropriate comments, enhancing the viewing experience.
  Automated Process: Set it and forget it. Youtarr will automatically update the Plex server with new content from the selected channels.
- **Easy to Use**: With a simple user interface and Dockerized deployment, setting up and running Youtarr should be straightforward for end-users, and will be improved with feedback. Docker takes care of most dependencies and setup.

## Disclaimer

While Youtarr provides a means to curate and download YouTube content, it's crucial to respect copyright laws and YouTube's Terms of Service. Always ensure you're in compliance with these guidelines when using the application.

## Usage

**You will first need to clone this repository.**:

**Before running this in either dev or production mode**: First run `./setup.sh`. This will let you select the root directory where Youtube videos that are downloaded will be placed.

### To run in production mode in a Docker container (for most users)

#### NOTES:

**This has been tested in git bash on Windows with Docker Desktop. This is designed to be run from the same system as your Plex server.**
**When running in production mode with the above config, your Plex Server IP Address should be set to host.docker.internal**

This app uses Plex for auth. To login it will use Plex and then will verify that the Plex server on the local system is accessible to the Plex account you logged in to.

**You must login to Youtarr using the same Plex account that you use to administer the Plex server you want to use Youtarr with!**

If not you will be unable to login.

1. Run `./start.sh`. The frontend UI will be exposed at `localhost:3087`
2. Once you are logged in, set your options in the Configuration screen and save them. You will want to select the Plex library that videos are supposed to be downloaded to, as well as the directory where they will be downloaded.
3. If you want to be able to browse videos from your subscribed channels from within the app, and initiate downloads of new videos that way, you will need to enter a Youtube API Key in your Configuration page as well.
   You can get an API key at https://console.developers.google.com/apis/credentials This is not required to run the app.
4. Once you set your download directory, you will need to restart the app. From the command line just to `./stop.sh` and then `./start.sh`

   Each video will be placed in a directory named for the Youtube channel it came from.

## Login Troubleshooting

**If you find that you are unable to login to Youtarr and get an error message that says**: "_Invalid Plex Account. You must use the Plex account associated to this Youtarr server._"

You may have a Plex token that is incorrectly associated to Youtarr. You can fix this by "resetting" the token that Youtarr stores by:

1. Shut Youtarr down or stop the docker container.
2. Edit config/config.json, edit the line that says plexApiKey by removing the stored key. After you are done the line should look like: `"plexApiKey": "",`
3. Restart Youtarr and reload it in your browser.

## Accessing Youtarr from Outside Your Network

If you wish to access Youtarr from outside your network, or from other computers aside from the one you are running it on, you will need to forward port 3087 on your local computer firewall (Eg: Windows Defender Firewall) and on your router.

## Commit Messages and Versioning

This project uses anothrNick/github-tag-action for automatic versioning based on commit messages. The version number is automatically incremented according to the commit message prefix.

To ensure proper versioning, please follow these guidelines when writing commit messages:

- For a patch version bump (e.g., v1.0.0 → v1.0.1), use the prefix fix: or docs: in your commit message.
- For a minor version bump (e.g., v1.0.0 → v1.1.0), use the prefix feat: in your commit message.
- For a major version bump (e.g., v1.0.0 → v2.0.0), include BREAKING CHANGE: in the commit message footer.

## Screenshots

![Alt text](/screenshots/youtarr_channels.jpg?raw=true 'Channels Screen')
![Alt text](/screenshots/youtarr_config.jpg?raw=true 'Config Screen')
![Alt text](/screenshots/youtarr_downloads.jpg?raw=true 'Downloads Screen')
![Alt text](/screenshots/youtarr_videos.jpg?raw=true 'Videos Screen')
![Alt text](/screenshots/youtarr_channels_mb.jpg?raw=true 'Channels Screen Mobile')
![Alt text](/screenshots/youtarr_config_mb.jpg?raw=true 'Config Screen Mobile')
![Alt text](/screenshots/youtarr_downloads_mb.jpg?raw=true 'Downloads Screen Mobile')
![Alt text](/screenshots/youtarr_videos_mb.jpg?raw=true 'Videos Screen Mobile')
![Alt text](/screenshots/youtarr_channel_view_pc.jpg?raw=true 'Individual Channel Screen')
