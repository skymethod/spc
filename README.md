# SPC
Standard Podcast Consumption (proposal)

## Why

Podcasting is built on open technologies: allowing anyone to publish, and anyone to listen - supporting various companies on both sides, agreeing to nothing but the [open standard](https://www.rssboard.org/rss-specification) that defines how podcasts are described.

Some podcast player apps keep track of various metrics happening on their app for each podcast, and make podcaster-facing portals available to help the podcaster see how their show is doing among listeners to that app (e.g. [Apple Podcasts](https://podcasters.apple.com/support/833-manage-your-podcast), [Spotify](https://support.spotify.com/us/article/spotify-for-creators/)).  Many podcasters find this information extremely helpful, but these metrics (like "how many people follow this show", or "how many people actually hit play on this episode") are only known by each app, completely unavailable to the podcaster's usual server-side tools like hosting-company dashboards, which are based on the only thing the server-side can see: [downloads](https://www.captivate.fm/podcast-growth/analytics/podcast-downloads-guide).

While one-off app-specific portals are useful, they each define and report information in [slightly different and incompatible ways](https://wearebumper.com/blog/one-big-number-how-to-combine-audio-video-podcast-data-across-apple-spotify-and-youtube), and require the podcaster to log into each platform or set up an unsupported custom integration based on scraping the portal content.

_Since podcasting is based on open standards, there should be a simple and uniform way for podcast apps to securely make a show's aggregate client-side metrics available to the podcaster.  After all, it's the podcaster's work that is powering their app's experience._

## What

This document describes a simple, standard mechanism that any podcast app can use to securely make these client-side metrics available to each podcaster.

> [!IMPORTANT]
> These are _aggregate_ metrics at the show/episode level, _not_ at the listener level.  This is not a new [RAD](https://www.npr.org/sections/npr-extra/2018/12/11/675250553/remote-audio-data-is-here), no listener IP addresses or proxies, just sums. In most cases, implementing this standard won't even require a change to an app's published policies whatsoever, since this aggregate information is likely already being collected and disclosed.

It's called **Standard Podcast Consumption**, or **SPC**, and can be implemented by podcast apps of any size.

## How

The mechanism is simple, inspired by what the popular podcast app [Overcast already does today](https://overcast.fm/podcasterinfo), namely: include podcast-specific information _inside_ the HTTP [user-agent](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/User-Agent) request header when the app's backend server fetches the podcast RSS feed.  _But instead of one metric (followers), a podcast-specific url to call back._

This elegant approach neatly solves the problem without needing complicated auth schemes.  The information is transferred server-to-server, ensuring the information is seen only by the podcaster (or the podcaster's hosting company), and never includes any given podcast listener in the call flow - avoiding accidental listener IP leakage.  It also does not require the app to make thousands of new outgoing fetch calls for every podcast, instead reusing the standard feed-level call that the app already makes.

To implement **SPC**, a podcast app needs to do three new things:
- Generate a podcast-specific, short, unique, unguessable **keystring** (case-sensitive and alpha-numeric only) for each podcast that has reportable client consumption metrics. A [random v4 uuid](https://guid.new/) without the dashes is a good choice, perhaps stored as a new column in the backend `podcast` database table
- Create and implement a new SPC API endpoint, hosted on a domain associated with the app.  This simple HTTPS endpoint must respond to `GET` requests, with one or more `p` query params (podcast-level keystrings), returning a standardized JSON response payload ([see below](#standard-responses)) with metrics for the associated podcasts.
- Include the podcast-specific endpoint url, prefixed by `SPC/`, anywhere inside the `user-agent` header when server-fetching a podcast’s RSS feed. An app called ExampleCast might send the following `user-agent` when server-fetching a feed for a podcast with associated keystring `5f71780061794eaa9e6c62fc967cb363`:

> `ExampleCast/1.0.1 SPC/https://api.examplecast.com/spc?p=5f71780061794eaa9e6c62fc967cb363`

Podcasters (or their hosting companies) can then parse these app-specific endpoints out of their logs and use them to query consumption metrics on an ongoing basis.

> [!NOTE]
> This requires no feed-level changes on the server side, so can be incrementally adopted whenever is convenient for the app - no need to wait for podcast publishers to change their feed generation, and no need for podcast publishers to change their feeds at all.  No new tags!

![spc-diagram](https://github.com/user-attachments/assets/3ba683d6-fd1b-408d-bb0b-1e2702e9d73c)
<p align="center"><i>New pieces needed to implement <b>SPC</b> (in red) vs unchanged existing infrastructure (black/gray)</i></p>

## Standard SPC API responses

At a high-level, every SPC API response is a standard UTF-8 encoded JSON object, consisting of a metrics result (or error) for every podcast specified in the query.  The standard podcast consumption metrics are defined as:

- Show-level follower[¹](#follower-def) count: "how many people are following this show" ie Apple Podcast followers, Overcast subscribers, etc

- Show-level all-time total listener[²](#listener-def) count

- Episode-level daily listener[²](#listener-def) count

- Episode-level all-time total listener[²](#listener-def) count

- Episode-level listener[²](#listener-def) histogram, expressed as a segment resolution (e.g. 60 seconds) and an array of per-resolution percentages of how many listeners listened to that segment

<a name="follower-def">[1]</a> a _follower_ is defined as a single person, across devices, that has indicated interest in receiving special notifications/autodownloads of new episodes for a given show

<a name="listener-def">[2]</a> a _listener_ is defined as a single person (across devices) that plays more than zero seconds of an episode

<hr>

**Example podcaster/hosting company request:**

`GET https://api.examplecast.com/spc?p=5f71780061794eaa9e6c62fc967cb363`

**Example podcast app SPC API endpoint response:**
```jsonc
// HTTP 200
{
  "results": {
    "5f71780061794eaa9e6c62fc967cb363": {
      "asOf": "2025-04-06T17:46:29.476Z", // utc timestamp at which this data is considered comprehensive
      "followerCount": 1234,
      "totalListeners": 25340,
      "episodes": {
        "episode-guid-10": {
          "totalListeners": 12345,
          "listenerHistogramResolutionSeconds": 60, // optional: default is 60, can specify higher-resolution (e.g. 30), but not lower (e.g. 120)
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

**Batch requests are possible by passing multiple keystrings for the same SPC API endpoint:**

`GET https://api.examplecast.com/spc?p=5f71780061794eaa9e6c62fc967cb363&p=93141cf56f7f4cf8a6eddcd519cd34e3`

```jsonc
// HTTP 200
{
  "results": {
    "5f71780061794eaa9e6c62fc967cb363": {
      "asOf": "2025-04-06T17:46:29.476Z",
      // ... rest of result for podcast 1
    },
    "93141cf56f7f4cf8a6eddcd519cd34e3": {
      "asOf": "2025-04-06T20:11:37.743Z",
      // ... rest of result for podcast 2
    }
  }
}
```
**Errors are returned using the 'error' property, and can be defined at the overall response-level for fatal problems...**

`GET https://api.examplecast.com/spc?p=`

```jsonc
// HTTP 400
{
  "error": "Invalid query"
}
```

**...or at the result level for partial successes to batch queries:**

`GET https://api.examplecast.com/spc?p=5f71780061794eaa9e6c62fc967cb363&p=93141cf56f7f4cf8a6eddcd519cd34eX`

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

All response payloads use the same format for simplicity.  The fields are described in the examples above, and also more formally as a [JSON Schema](/spc.schema.json) and [Typescript type definition](/spc.d.ts).

All metrics are highly encouraged, but optional.  Leave any unimplemented/uncollected metrics out of the associated show-level or episode-level portions of the response.

## FAQ

#### Do these numbers mean "downloads" are obsolete? ####

Not at all, these client-side metrics are self-reported by each app and should always be sanity-checked against the corresponding downloads.  They are _in addition to_, not _a replacement of_ the traditional download-based metrics, and should always be displayed to podcasters in separate charts - as to avoid comparing apples and oranges.

#### Does this mean these numbers will be public? ####

Not in the sense that anyone can see them by default, that should remain the choice of the podcaster.  Although the API endpoint is public in the HTTP sense, keystrings should be unguessable and long enough to combat enumeration attacks.  This is similar to how "private feeds" are implemented in podcast-land today.  Once the SPC API url is received by the podcaster, they are free to share it with other services used for stats aggregation and display.

#### Where will this standard live once adopted? ####

This standard probably makes sense to live under a group or organization, like the [OPAWG](https://github.com/opawg).  I'd be willing to donate it there, this idea is freely available!


## Get involved

If you work on a podcast app, and are planning on implementing SPC, leave a note over in the [discussion area](https://github.com/skymethod/spc/discussions) and I'll keep a list of supporting apps on this page.
