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
      let colectionsInSync = true;
      let attempts = 100;
      do {
        colectionsInSync = true;
        let countInSync = 0;
        let countStillWaiting = 0;
        arango.GET('/_api/replication/clusterInventory').collections.forEach(col => {
          colectionsInSync &= col.allInSync;
          if (!col.allInSync) {
            print("not in sync: ");
            print(col);
            countStillWaiting += 1;
          } else {
            countInSync+= 1;
          }
        });
        if (!colectionsInSync) {
          require('internal').sleep(1);
          print(`Amount of collection in sync: "${countInSync}". Still not in sync: ${countStillWaiting}`);
        }
        attempts -= 1;
      } while (!colectionsInSync && (attempts > 0));
      assertTrue(attempts > 0);
    }
  };
}

jsunity.run(SyncCheckSuite);

return jsunity.done();
