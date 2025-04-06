export type SpcQueryResponse = ResultsResponse | CommonError;

export type ResultsResponse = {
    results: Record<string /* keystring */, PodcastMetricsResult | CommonError>
};

export type PodcastMetricsResult = {
    asOf: string, // (required) utc timestamp
    followerCount?: number, // non-negative integer
    totalListeners?: number, // non-negative integer
    episodes?: Record<string /* episode guid from rss feed */, EpisodeMetricsResult>
};

export type EpisodeMetricsResult = {
    totalListeners?: number, // non-negative integer
    listenerHistogramResolution?: '1m' | '30s', // 1m is the default
    listenerHistogram?: number[], // percentage floats from 0.0 (inclusive) to 100.0 inclusive, one for each minute if listenerHistogramResolution = '1m'
    dailyListeners?: Record<string /* utc-day (yyyy-mm-dd) */, number /* non-negative integer */>
};

export type CommonError = {
    error: string
};
