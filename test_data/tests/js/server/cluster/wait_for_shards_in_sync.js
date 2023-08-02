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
      let colectionsInSync = true;
      let attempts = 100;
      do {
        colectionsInSync = true;
        let countInSync = 0;
        let countStillWaiting = 0;
        let cols = arango.GET('/_api/replication/clusterInventory').collections;
        cols.forEach(col => {
          colectionsInSync &= col.allInSync;
          if (!col.allInSync) {
            countStillWaiting += 1;
          } else {
            countInSync+= 1;
          }
        });
        if (!colectionsInSync) {
          require('internal').sleep(1);
          if (attempts % 50 === 0) {
            print(cols);
          }
          print(`Amount of collection in sync: "${countInSync}". Still not in sync: ${countStillWaiting}`);
        }
        if (firstExec) {
          firstExec = false;
          if (countInSync + countStillWaiting > 100) {
            attempts = Math.round((countInSync + countStillWaiting) * 0.8);
            print(`Set attempts to ${attempts}`);
          }
        }
        attempts -= 1;
      } while (!colectionsInSync && (attempts > 0));
      assertTrue(attempts > 0);
    }
  };
}

jsunity.run(SyncCheckSuite);

return jsunity.done();
