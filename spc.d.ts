export type SpcQueryResponse = ResultsResponse | CommonError;

export type ResultsResponse = {
    results: Record<string /* podcast-level keystring */, PodcastMetricsResult | CommonError>
};

export type PodcastMetricsResult = {
    asOf: string, // (required) utc timestamp
    followerCount?: number, // non-negative integer
    totalListeners?: number, // non-negative integer
    episodes?: Record<string /* episode guid from rss feed */, EpisodeMetricsResult>
};

export type EpisodeMetricsResult = {
    totalListeners?: number, // non-negative integer
    listenerHistogramResolutionSeconds?: number, // default is 60, can specify higher-resolution (e.g. 30), but not lower (e.g. 120)
    listenerHistogram?: number[], // percentage floats from 0.0 (inclusive) to 100.0 inclusive, one for each minute if listenerHistogramResolution = '1m'
    dailyListeners?: Record<string /* utc-day (yyyy-mm-dd) */, number /* non-negative integer */>
};

export type CommonError = {
    error: string
};
