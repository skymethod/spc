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
  - must respond to GET requests, with one or more `q` query params (keystrings), returning a standardized JSON query results payload ([see below](#standard-responses))
- Include the podcast-specific endpoint url, prefixed by `spc/` anywhere inside the user-agent when server-fetching a podcast's feed.
  - An app called ExampleCast might send the following user-agent when server-fetching a feed for a podcast with associated keystring `5f71780061794eaa9e6c62fc967cb363`

> `ExampleCast/1.0.1 spc/https://api.examplecast.com/spc?q=5f71780061794eaa9e6c62fc967cb363`

Podcasters (or their hosting companies) can then parse these app-specific endpoints out of their logs and use them to query consumption metrics on an ongoing basis.

> [!NOTE]
> This requires no feed-level changes on the server side, so can be incrementally adopted whenever is convenient for the app - no need to wait for podcast publishers to change their feed generation.

## Standard responses

At a high-level, every API response is standard UTF-8 JSON, consisting of the a metrics result (or error) for each podcast specified in the query.  The standard podcast consumption metrics are defined as:

- Show-level follower[^1] count: "how many people are following this show" ie Apple Podcast followers, Overcast subscribers, etc

- Show-level all-time total listener[^2] count

- Episode-level daily listener[^2] count

- Episode-level all-time total listener[^2] count

- Episode-level listener[^2] histogram, expressed as a segment resolution (e.g. `1m`) and an array of per-resolution percentages of how many listeners listened to that segment

[^1]: a _follower_ is defined as a single person, across devices, that has indicated interest in receiving special notifications/autodownloads of new episodes for a given show

[^2]: a _listener_ is defined as a single person (across devices) that plays at least 60 seconds of an episode

**Example podcaster/hosting company request:**

`GET https://api.examplecast.com/spc?q=5f71780061794eaa9e6c62fc967cb363`

**Example podcast app api endpoint response:**
```jsonc
// HTTP 200
{
  "results": {
    "5f71780061794eaa9e6c62fc967cb363": {
      "asOf": "2025-04-06T17:46:29.476Z",
      "followerCount": 1234,
      "totalListeners": 25340,
      "episodes": {
        "episode-guid-10": {
          "totalListeners": 12345,
          "listenerHistogramResolution": "1m", // optional: default is '1m'
          "listenerHistogram": [ 100, 90.5, 90.43, 90.43, /** ... for every minute of the episode */ ],
          "dailyListeners": {
            "2025-04-01": 1002,
            "2025-04-02": 920,
            "2025-04-02": 432,
            "2025-04-03": 200,
            "2025-04-04": 102
          }
        },
        "episode-guid-9": {
          "totalListeners": 18220,
          "listenerHistogram": [ 100, 90.4, 89,5, 72.3, /** ... for every minute of the episode */ ],
          "dailyListeners": {
            // ...
          }
        },
        //...(more episodes)
      }
    }
  }
}
```

**Batch requests are possible by passing multiple keystrings for the same app api endpoint:**

`GET https://api.examplecast.com/spc?q=5f71780061794eaa9e6c62fc967cb363&q=93141cf56f7f4cf8a6eddcd519cd34e3`

```jsonc
// HTTP 200
{
  "results": {
    "5f71780061794eaa9e6c62fc967cb363": {
      "asOf": "2025-04-06T17:46:29.476Z",
      // ... rest of result
    },
    "93141cf56f7f4cf8a6eddcd519cd34e3": {
      "asOf": "2025-04-06T20:11:37.743Z",
      // ... rest of result
    }
  }
}
```
**Errors are returned using the 'error' property, and can be defined at the overall response-level for fatal problems...**

`GET https://api.examplecast.com/spc?q=`

```jsonc
// HTTP 400
{
  "error": "Invalid query"
}
```

**...or at the result level for partial successes to batch queries.**

`GET https://api.examplecast.com/spc?q=5f71780061794eaa9e6c62fc967cb363&q=93141cf56f7f4cf8a6eddcd519cd34eX`

```jsonc
// HTTP 200 (or 207 for extra credit)
{
  "results": {
    "5f71780061794eaa9e6c62fc967cb363": {
      "asOf": "2025-04-06T17:46:29.476Z",
      // ... rest of result
    },
    "93141cf56f7f4cf8a6eddcd519cd34eX": {
      "error": "Unknown keystring"
    }
  }
}
```

All response payloads use the same format for simplicity.  The fields are described in examples above, and also more formally as a [JSON Schema](/scp.schema.json) or [Typescript type definition](/scp.d.ts).

All metrics are optional, leave any unimplemented/uncollected metrics out of the associated show-level or episode-level portions of the response.

## FAQ

#### Do these numbers mean "downloads" are obsolete? ####

Not at all, these client-side metrics are self-reported by each app and should always be sanity-checked against the corresponding downloads.  They are _in addition to_, not _a replacement of_ the traditional download-based metrics, and should always be displayed to podcasters in separate charts - as to avoid comparing apples and oranges.

#### Does this mean these numbers will be public? ####

Not in the sense that anyone can see them by default, that should remain the choice of the podcaster.  Although the api endpoint is public in the http sense, keystrings should be unguessable and long enough to combat enumeration attacks.  This is similar to how "private feeds" are implemented today.  Once the spc url is received by the podcaster, they are free to share it with other services used for stats aggregation and display.

#### Where will this standard live once adopted? ####

This standard probably makes sense to live under a larger organization, like the [OPAWG](https://github.com/opawg).  I'd be willing to donate it there, this idea is freely available!
