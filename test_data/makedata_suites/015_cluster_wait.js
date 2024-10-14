/* global print, db, internal, arango, semver */

/* This handler is here to wait for every shard of every collection to have an appropriate number of
 follower nodes(e.g. if replicationFactor parameter is set to 2 for a collection, then each shard
 must have one leader and one follower node). This handler is only ran for enterprise edition,
 because  currently the only test suite that needs this is applicable only to enterprise edition.*/

(function () {
  return {
    isSupported: function (version, oldVersion, options, enterprise, cluster) {
     return (options.disabledDbserverUUID !== "" && cluster);
    },
    checkDataDB: function (options, isCluster, isEnterprise, dbCount, readOnly) {
      print(`${Date()} 015: checking data ${dbCount}`);
      let count = 0;
      let collections = [];
      print(`${Date()} 015: waiting for all shards on ${options.disabledDbserverUUID} to be moved`);
      while (count < 500) {
        collections = [];
        let found = 0;
        db._collections().map((c) => c.name()).forEach((c) => {
          let shards = db[c].shards(true);
          Object.values(shards).forEach((serverList) => {
            if (serverList.length > 0 && serverList.includes(options.disabledDbserverUUID)) {
              ++found;
              collections.push(c);
            }
          });
        });
        if (found > 0) {
          print(`${Date()} 015: ${found} found - Waiting - ${JSON.stringify(collections)}`);
          internal.sleep(1);
          count += 1;
        } else {
          break;
        }
      }
      if (count > 499) {
        let collectionData = "Still have collections bound to the failed server: ";
        collections.forEach(col => {
          print(`${Date()} 015: ${col}`);
          collectionData += "\n" + JSON.stringify(col) + ":\n" +
            JSON.stringify(db[col].shards(true)) + "\n" +
            JSON.stringify(db[col].properties());
        });
        print(`${Date()} 015: ${collectionData}`);
        throw ("Still have collections bound to the failed server: " + JSON.stringify(collections));
      }
      print(`${Date()} 015: done - continuing test.`);
      return 0;
    }
  };
}());
