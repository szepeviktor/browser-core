// operators
import Enricher from '../operators/enricher';

// mixers
import contextSearch from '../mixers/context-search';
import deduplicate from '../mixers/deduplicate';
import enrich from '../mixers/enrich';
import { searchOnEmpty, searchOnNotEmpty } from '../mixers/search-on-empty';
import updateIncompleteResults from '../mixers/update-incomplete-results';
import addOffers from '../mixers/add-offers';
import removeOffers from '../operators/remove-offers';
import waitForResultsFrom from '../operators/streams/wait-for-results-from';
import combineAnyLatest from '../operators/streams/static/combine-any-latest';

/*
 * Constructs a result stream by mixing results from multiple providers
 * for the given query string.
 */
const mixResults = ({ query, ...params }, providers, enricher = new Enricher(), config) => {
  const results = {
    instant: Object.create(null),
    calculator: Object.create(null),
    history: Object.create(null),
    historyView: Object.create(null),
    cliqz: Object.create(null),
    suggestions: Object.create(null),
  };

  const searchParams = [query, config, params];
  // TODO: also dedup within history results
  results.history.source$ = providers.history.search(...searchParams).share();
  results.historyView.source$ =
    searchOnNotEmpty(providers.historyView, results.history.source$, ...searchParams);
  results.cliqz.source$ = providers.cliqz.search(...searchParams).share();
  results.instant.source$ = providers.instant.search(...searchParams);
  results.calculator.source$ = providers.calculator.search(...searchParams);

  results.cliqz.results$ = results.cliqz.source$
    .filter(({ provider }) => provider === 'cliqz')
    .map(removeOffers)
    .share();
  results.cliqz.offers$ = results.cliqz.source$
    .filter(({ provider }) => provider === 'cliqz::offers')
    .share();

  results.cliqz.resultsWithOffers$ = addOffers(
    results.cliqz.results$,
    results.cliqz.offers$,
    config,
  );

  results.history.resultsWithOffers$ = addOffers(
    results.history.source$,
    results.cliqz.offers$,
    config,
    { allowStandalone: false },
  );

  // fetch rich header promises
  results.cliqz.updated$ = updateIncompleteResults(
    providers.richHeader,
    results.cliqz.resultsWithOffers$,
    ...searchParams
  );

  // add search suggestions if no other results
  results.suggestions.source$ = searchOnEmpty(
    providers.querySuggestions,
    results.cliqz.updated$,
    ...searchParams
  );

  // contextSearch (if enabled) makes a second call to the cliqz
  results.cliqz.expanded$ = contextSearch(
    providers.cliqz,
    results.cliqz.updated$,
    ...searchParams
  ).share();

  const deduplicated = deduplicate(
    results.cliqz.expanded$,
    results.history.resultsWithOffers$
  );
  results.cliqz.deduplicated$ = deduplicated.target$;
  results.history.annotated$ = deduplicated.reference$;

  // TODO: how to update 'kind' for enriched history results?
  results.history.enriched$ = enrich(
    enricher,
    results.history.annotated$,
    results.cliqz.expanded$
  );

  results.instant.latest$ = results.instant.source$;
  results.calculator.latest$ = results.calculator.source$;
  results.history.latest$ = results.history.enriched$;
  results.historyView.latest$ = results.historyView.source$;
  results.cliqz.latest$ = results.cliqz.deduplicated$;
  results.suggestions.latest$ = results.suggestions.source$;

  // sorting providers happens in `smooth` operator
  const latestResults = Object.keys(config.providers)
    .filter(id => results[id])
    .map((id) => {
      const dependencies = (config.providers[id].dependencies || [])
        .filter(({ condition }) => condition({
          query,
          keyCode: params.keyCode,
        }));

      // no dependencies
      if (dependencies.length === 0) {
        return results[id].latest$;
      }

      // wait until one of the dependencies has results
      return results[id].latest$.let(
        waitForResultsFrom(
          dependencies.map(({ provider }) => results[provider].latest$))
      );
    });

  const mixed$ = combineAnyLatest(latestResults)
    // throttle because, otherwise, 'instant' will emit before 'history'
    // even if 'instant' was waiting for 'history' (supposingly due to
    // internal wiring of RxJS)
    .debounceTime(1)
    .map(responses => responses.map(response => ({ ...response, params })));
  return mixed$;
};

export default mixResults;
