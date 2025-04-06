# spc
Standard Podcast Consumption (proposal)

## Why

Podcasting is built on open technologies: allowing anyone to publish, and anyone to listen - supporting various companies on both sides, agreeing to nothing but the standard that defines how podcasts are described.

Some podcast player apps keep track of various metrics happening on their app for each podcast, and make podcaster-facing portals available to help the podcaster see how their show is doing among listeners to that app (e.g. [Apple Podcasts](https://podcasters.apple.com/support/833-manage-your-podcast), [Spotify](https://support.spotify.com/us/article/spotify-for-creators/)).  Most of these metrics (like "how many people follow this show", or "how many people actually hit play on this episode") are only known by each app, completely unavailable to the podcaster's usual server-side tools like hosting-company dashboards, which are based on the only thing the server-side can see: downloads.

While one-off app-specific portals are useful, they each define and report information in [slightly different and incompatible ways](https://wearebumper.com/blog/one-big-number-how-to-combine-audio-video-podcast-data-across-apple-spotify-and-youtube), and require the podcaster to log into each platform or set up an unsupported custom integration based on scraping the portal content.

Since podcasting is based on open standards, there should be a simple and uniform way for podcast apps to securely provide aggregate client-side metrics for each show back to podcasters.

## What

This document describes a simple, standard mechanism that any podcast app can use to securely provide these client-side metrics back to each podcaster.

> [!IMPORTANT]
> These are _aggregate_ metrics at the show/episode level, _not_ at the listener level.  This is not a new [RAD](https://www.npr.org/sections/npr-extra/2018/12/11/675250553/remote-audio-data-is-here), no listener IP address or proxies, just sums. In most cases, implementation may not prompt a change to an app's published policies at all, since this is aggregate information that is likely already being collected.

It's called **Standard Podcast Consumption**, or **spc**

## How

The mechanism is simple, inspired by what the popular podcast app [Overcast already does today](https://overcast.fm/podcasterinfo), namely including podcast-specific information _inside_ the http user-agent request header when the app's backend server fetches the feed.

This elegant approach neatly solves the problem without needing complicated auth schemes.  The information is transferred server-to-server, ensuring the information is seen only by the podcaster (or the podcaster's hosting company), and never includes any given podcast listener in the call flow - avoiding any accidental listener IP leakage.  It also requires no new outgoing fetch calls for every podcast, reusing the standard feed-level call that the app already makes.

To implement **spc**, here's what a podcast app needs to do:
- Generate a short, unique, unguessable **keystring** (case-sensitive and alpha-numeric only) for each podcast that has reportable client consumption metrics
  - Example: a random v4 uuid without the dashes, perhaps stored as a new column in the backend `podcast` database table
- Create a new api server https endpoint hosted on a domain associated with the app
  - must respond to GET requests, with one or more `q` query params (keystrings), returning a standardized JSON results payload (see below)
- Include the podcast-specific endpoint url, prefixed by `spc/` anywhere inside the user-agent when server-fetching a podcast's feed.
  - Example: an app called ExampleCast might send the following user-agent when server-fetching a feed for a podcast with associated keystring `5f71780061794eaa9e6c62fc967cb363`

> `ExampleCast/1.0.1 spc/https://api.examplecast.com/spc?q=5f71780061794eaa9e6c62fc967cb363`

Podcasters (or their hosting companies) can then parse these app-specific endpoints out of their logs and use them to query consumption metrics on an ongoing basis.

## Standard response payloads

For each podcast requested in the query:

Show-level follower count: "how many people are following this show" ie Apple Podcast followers, Overcast subscribers, etc

Show-level all-time total listener count

Episode-level daily listener count, where a listener is defined as a single person (across devices) that plays at least 60 seconds of the episode in the 24-hr period

Episode-level all-time total listener count

Episode retention histograms, expressed as a resolution (e.g. 1m) and an array of per-resolution percentages

TODO others?

TODO describe standard JSON payload format with examples

## FAQ

_Do these numbers mean "downloads" are obsolete?_

Not at all, these client-side metrics are self-reported by each app and should always been sanity-checked against the corresponding downloads.  They are _in addition to_, not _a replacement of_ the traditional download-based metrics, and should always be displayed to the podcasters in separate charts - as to avoid comparing apples and oranges.

TODO others?
