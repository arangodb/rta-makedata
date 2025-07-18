/*jshint globalstrict:false, strict:false, unused: false */
/*global assertEqual, assertTrue, arango, print, ARGUMENTS */

var jsunity = require("jsunity");


function SyncCheckSuite() {
  'use strict';
  return {

    setUp: function() {
    },

    tearDown: function() {
    },

    testCollectionInSync: function() {
      let firstExec = true;
      let attempts = 100;
      do {
        let collectionsInSync = true;
        let rState = arango.GET('/_api/replication/logger-state');
        let serverTick = rState.state.lastLogTick;
        let caughtUp = true;
        rState.clients.forEach(client => {
          if (serverTick - client.lastServed > 100) {
            caughtUp = false;
          }
        });
        if (caughtUp) {
          return true;
        }
        require('internal').sleep(1);
        if (attempts % 5 === 0) {
          print(".");
        }
        attempts -= 1;
      } while (attempts > 0);
      assertTrue(attempts > 0);
    }
  };
}

jsunity.run(SyncCheckSuite);

return jsunity.done();
