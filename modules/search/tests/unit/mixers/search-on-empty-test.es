const Rx = require('rxjs');
const rxSandbox = require('rx-sandbox').rxSandbox;

let fetch = () => {};

const mock = {
  'platform/lib/rxjs': {
    default: Rx,
  },
  'search/responses': {
    getEmptyResponse: () => 'e',
  },
};

export default describeModule('search/mixers/search-on-empty',
  () => mock,
  () => {
    describe('#searchOnEmpty', function() {
      let searchOnEmpty;

      beforeEach(function () {
        searchOnEmpty = this.module().searchOnEmpty;
      });

      it('searches using provider if base stream concludes without results', function() {
        const { hot, cold, flush, getMessages, e, s } = rxSandbox.create();

        const query = '';
        const provider = {
          search: () => hot('s-ss|'),
        };
        const base$ =    hot('----n|', {
          n: {
            results: [],
            state: 'done'
          }
        });
        const expected = e('  ----s-ss|');

        const messages = getMessages(searchOnEmpty(provider, base$, query, {}, {}));
        flush();

        return chai.expect(messages).to.deep.equal(expected);
      });

      it('emits empty response if base stream concludes with results ', function() {
        const { hot, cold, flush, getMessages, e, s } = rxSandbox.create();

        const query = '';
        const provider = {
          search: () => hot('s|'),
        };
        const base$ =    hot('----n|', {
          n: {
            results: ['r1'],
            state: 'done'
          }
        });
        const expected = e('  -----(e|)');

        const messages = getMessages(searchOnEmpty(provider, base$, query, {}, {}));
        flush();

        return chai.expect(messages).to.deep.equal(expected);
      });
    });
  },
);
