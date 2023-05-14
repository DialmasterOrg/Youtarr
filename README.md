# YoutubePlexArr

## Description

YoutubePlexArr is a Dockerized application that offers a user-friendly way to automatically download videos from YouTube channels that you've handpicked, and integrates them seamlessly into your Plex Media Server. 
Note that this is in no way endorsed by, or associated with Youtube itself.

## NOTE: WORK IN PROGRESS (AS OF MAY 14th 2023 THIS IS A WORK IN PROGRESS!!)

This code is not yet complete, this Readme will be updated when it is complete.

## Overview

In the era of digital media, ensuring safe and appropriate content for your children can be a challenge. Youtube, while being a vast reservoir of educational and entertaining content, also hosts content that might not be suitable for children. To strike a balance, YoutubePlexArr allows you to curate YouTube channels so that you can provide a vetted, customized and safe YouTube experience for your kids.

The application operates by running a scheduled task that automatically downloads new videos, along with their thumbnails and metadata, from a list of YouTube channels that you specify. These videos are then automatically added to your Plex server.


## Key Features
* **Parental Control**: Vet the channels and control the quality and appropriateness of the content available to your children.
* **Ad-free Experience**: Running the content through a Plex server eliminates ads and potential exposure to inappropriate comments, enhancing the viewing experience.
Automated Process: Set it and forget it. YoutubePlexArr will automatically update the Plex server with new content from the selected channels.
* **Easy to Use**: With a simple user interface and Dockerized deployment, setting up and running YoutubePlexArr is a breeze, even for non-technical users.

## Dockerized for Ease of Use
YoutubePlexArr is completely Dockerized, which means it's straightforward to get up and running, regardless of your operating system or technical skill level. Docker takes care of all the dependencies and setup, leaving you free to focus on choosing the best YouTube channels for your Plex server.

## Disclaimer
While YoutubePlexArr provides a means to curate and download YouTube content, it's crucial to respect copyright laws and YouTube's Terms of Service. Always ensure you're in compliance with these guidelines when using the application.
## Usage

Before running this in either dev or production mode, first run ```./setup.sh```. This will let you select the root directory where Youtube videos that are downloaded will be placed.

### To run locally on the host with hot reload (for development)
Run ```npm run dev```. The frontend UI will be exposed at localhost:3000

### To run in production mode in a Docker container (for end users)

1. Run ```./build.sh``` then run ```start.sh```. The frontend UI will be exposed at localhost:3087


