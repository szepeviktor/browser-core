/* eslint no-param-reassign: ["error", { "props": false }] */
import { fetch, Request, Headers } from '../core/http';
import logger from './common/offers_v2_logger';
import OffersConfigs from './offers_configs';
import { timestampMS } from './utils';

// Define for how long we want to cache the data here
const CACHE_ENTRY_DURATION_SECS = 5 * 60; // 5 mins?
// after how many calls we want to check if clear the cahce, we can improve this
const CACHE_CLEAR_FREQ = 10;

/**
 * Helper class to hold a cache entry
 */
class CacheEntry {
  constructor(data, responseStatus = null) {
    this.data = data;
    this.responseStatus = responseStatus;
    this.createdTS = timestampMS();
  }
  expired() {
    return ((timestampMS() - this.createdTS) / 1000) > CACHE_ENTRY_DURATION_SECS;
  }
  wasFailedCall() {
    return this.responseStatus !== null && this.responseStatus >= 400;
  }
}

/**
 * this module will be used to perform queries to the BE and fetch triggers
 * We can in the future implement some cache system here so we store the triggers
 * locally with a given TTL. This will also perform better.
 */
export default class BEConnector {
  constructor() {
    this._cache = new Map();
    this._cacheClearCount = CACHE_CLEAR_FREQ;
  }


  /**
   * performs the query for the given endpoint and params.
   * If the query performs correctly we will return the parsed json result as
   * the resolved argument of the promise.
   * Otherwise the error message will be returned on the reject method
   * @param  {[type]} endpoint [description]
   * @param  {[type]} params   [description]
   * @return {Promise}          [description]
   */
  sendApiRequest(endpoint, params, method = 'POST') {
    logger.info('backend_connector', 'sendApiRequest called');

    this._expireCache();

    // we will always set the engine version as argument
    params.t_eng_ver = OffersConfigs.TRIGGER_ENGINE_VERSION;
    const url = this._buildUrl(endpoint, params);

    // check if we have cache here
    const cacheEntry = this._cache.has(url) ? this._cache.get(url) : null;

    if (cacheEntry && !cacheEntry.expired()) {
      logger.debug('we have data cached for ', url);
      // check if was a failed call or not to reject the promise or not and keep
      // the same behavior for the one who calls
      if (cacheEntry.wasFailedCall()) {
        return Promise.reject(`Cached failed call: code ${cacheEntry.responseStatus} - ${url}`);
      }
      return Promise.resolve(cacheEntry.data);
    }

    logger.info('backend_connector', `url called: ${url}`);
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');
    const request = new Request(url, { headers, method });

    return fetch(request).then((response) => {
      if (response.ok) {
        // set the cache
        return response.json().then((resultResponse) => {
          this._cache.set(url, new CacheEntry(resultResponse));
          return Promise.resolve(resultResponse);
        });
      }
      this._cache.set(url, new CacheEntry(null, response.status));
      return Promise.reject(`Status code ${response.status} for ${url}`);
    });
  }

  _buildUrl(endpoint, params) {
    return `${OffersConfigs.BACKEND_URL}/api/v1/${endpoint}?`.concat(
      Object.keys(params).map(key => `${key}=${encodeURIComponent(params[key])}`).join('&')
    );
  }

  _expireCache() {
    this._cacheClearCount -= 1;
    if (this._cacheClearCount > 0) {
      return;
    }
    this._cacheClearCount = CACHE_CLEAR_FREQ;

    this._cache.forEach((cacheEntry, cacheID) => {
      if (cacheEntry.expired()) {
        this._cache.delete(cacheID);
      }
    });
  }
}
