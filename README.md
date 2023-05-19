# Youtarr

## Description

Youtarr is a Dockerized application that offers a user-friendly way to automatically download videos from YouTube channels that you've handpicked, and integrates them seamlessly into your Plex Media Server.
Note that this is in no way endorsed by, or associated with Youtube or the Plex team.

## NOTE: (AS OF MAY 16th 2023 THIS IS A WORK IN PROGRESS AND IS NOT YET POLISHED FOR END USERS)
Input is welcome, but I would not advise the average "end user" to attempt to use this yet, unless they are brave.

## Overview

In the era of digital media, ensuring safe and appropriate content for your children can be a challenge. Youtube, while being a vast reservoir of educational and entertaining content, also hosts content that might not be suitable for children. To strike a balance, Youtarr allows you to curate YouTube channels so that you can provide a vetted, customized and safe YouTube experience for your kids.

The application operates by running a scheduled task that automatically downloads new videos, along with their thumbnails and metadata, from a list of YouTube channels that you specify. These videos are then automatically added to your Plex server and a library scan is initiated as soon as downloads are complete.

## Requirements

**This is designed to be run from the same computer that is running your Plex server as it needs direct access to write video files to the directory that you use for your Plex Youtube library**

To use Youtarr, you need to have the following software installed on your system:

1. **Docker:** Youtarr uses Docker to create an isolated environment where it can run without interfering with your system or requiring you to install a bunch of software. You can download Docker from the official website.

2. **Python:** Python is used in some of the setup scripts to handle the parsing and writing of the JSON configuration file. Most systems come pre-installed with Python, but if you don't have it, you can download it from the official website.

3. **Bash Shell:** Bash is a Unix shell and command language. The setup and start scripts are written in bash. For Windows users, you can use Git Bash, which is included when you install Git for Windows.

4. **npm (Node Package Manager):** npm is a package manager for the JavaScript programming language. It is used to install the dependencies that Youtarr needs to run in development mode. If you have Node.js installed on your machine, npm is typically installed with it. If not, you can download Node.js (which includes npm) from the official website.

Please ensure that you have these installed and available in your system's PATH before you proceed with the installation of Youtarr.

## Key Features
* **Parental Control**: Vet the channels and control the quality and appropriateness of the content available to your children.
* **Ad-free Experience**: Running the content through a Plex server eliminates ads and potential exposure to inappropriate comments, enhancing the viewing experience.
Automated Process: Set it and forget it. Youtarr will automatically update the Plex server with new content from the selected channels.
* **Easy to Use**: With a simple user interface and Dockerized deployment, setting up and running Youtarr is a breeze, even for non-technical users.

## Dockerized for Ease of Use
Youtarr is completely Dockerized, which means it's straightforward to get up and running, regardless of your operating system or technical skill level. Docker takes care of all the dependencies and setup, leaving you free to focus on choosing the best YouTube channels for your Plex server.

## Disclaimer
While Youtarr provides a means to curate and download YouTube content, it's crucial to respect copyright laws and YouTube's Terms of Service. Always ensure you're in compliance with these guidelines when using the application.
## Usage

**Before running this in either dev or production mode**: First run ```./setup.sh```. This will let you select the root directory where Youtube videos that are downloaded will be placed.

### To run locally on the host with hot reload (for development -- NOT FOR END USERS)
Run ```npm run dev```. The frontend UI will be exposed at localhost:3000
This does not yet work with actual downloading as the yt-dlp and ffmpeg dependencies will not be pulled in correctly

### To run in production mode in a Docker container (for most users)

#### NOTES:
**This has been tested in git bash on Windows with Docker Desktop. This is designed to be run from the same system as your Plex server.**
**When running in production mode with the above config, your Plex Server IP Address should be set to host.docker.internal**

This app uses Plex for auth. To login it will use Plex and then will verify that the Plex server on the local system is accessible to the Plex account you logged in to.
If not you will be unable to login.


1. Run ```./start.sh```. The frontend UI will be exposed at ```localhost:3087```
2. Once you are logged in, set your options in the Configuration screen and save them. You will want to select the Plex library that videos are supposed to be downloaded to, as well as the directory where they will be downloaded.
3. Once you set your download directory, you will need to restart the app. From the command line just to ```./stop.sh``` and then ```./start.sh```

   Each video will be placed in a directory named for the Youtube channel it came from.
