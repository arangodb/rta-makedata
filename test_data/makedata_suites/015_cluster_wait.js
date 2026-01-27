/* global print, db, internal, arango, semver, versionHas */

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
      db._useDatabase("_system");
      let dbs = db._databases();
      print(`${Date()} 015: waiting for all shards on ${options.disabledDbserverUUID} to be moved`);
      print(`${Date()} 015: Wait for all collections to get updated servers for shards`);
      const maxCount = (versionHas('tsan') || versionHas('asan')) ? 2000:500;
      while (count < maxCount) {
        let dbsOk = 0;
        dbs.forEach(oneDb => {
          db._useDatabase(oneDb);
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
            dbsOk += 1;
            return;
          }
        });
        if (dbsOk === dbs.length) {
          break;
        }
      }
      if (count >= maxCount) {
        let collectionData = "Still have collections bound to the failed server: ";
        dbs.forEach(oneDb => {
          db._useDatabase(oneDb);
          collections.forEach(col => {
            print(`${Date()} 015: ${col}`);
            collectionData += "\n" + JSON.stringify(col) + ":\n" +
              JSON.stringify(db[col].shards(true)) + "\n" +
              JSON.stringify(db[col].properties());
          });
          print(`${Date()} 015: ${oneDb} - ${collectionData}`);
        });
        print(`${Date()} 015: ${collectionData}`);
        throw ("015: Still have collections bound to the failed server: " + JSON.stringify(collections));
      }
      print(`${Date()} 015: first check done - shards moved.`);

      print(`${Date()} 015: Wait for current and plan to become the same`);
      count = 0;
      while (count < maxCount) {
        let dbsOk = 0;
        dbs.forEach(oneDb => {
          db._useDatabase(oneDb);
          collections = [];
          let found = 0;
          let shardDist = arango.GET("/_admin/cluster/shardDistribution");
          if (shardDist.code !== 200 || typeof shardDist.results !== "object") {
            ++count;
            return;
          }
          let cols = Object.keys(shardDist.results);
          cols.forEach((c) => {
            let col = shardDist.results[c];
            let shards = Object.keys(col.Plan);
            shards.forEach((s) => {
              try {
                if (col.Current.hasOwnProperty(s) && (col.Plan[s].leader !== col.Current[s].leader)) {
                  ++found;
                  collections.push([c, s]);
                }
              } catch (ex) {
                print(`${Date()} 015: ${s}`);
                print(`${Date()} 015: ${JSON.stringify(col)}`);
                print(`${Date()} 015: ${ex}`);
              }
            });
          });
          if (found > 0) {
            print(`${Date()} 015: ${found} found - Waiting - ${JSON.stringify(collections)}`);
            internal.sleep(1);
            count += 1;
          } else {
            dbsOk += 1;
            return;
          }
        });
        if (dbs.length === dbsOk) {
          break;
        }
      }
      if (count >= maxCount) {
        let collectionData = "Still have collections with mismatched leaders: ";
        collections.forEach(col => {
          print(`${Date()} 015: ${JSON.stringify(col)}`);
          collectionData += "\n" + JSON.stringify(col);
        });
        print(`${Date()} 015: ${collectionData}`);
        throw ("015: Still have collections with mismatched leaders: " + JSON.stringify(collections));
      }
      print(`${Date()} 015: second check done - plan and current are synced.`);
      print(`${Date()} 015: all checks done - continuing test.`);
      db._useDatabase('_system');
      return 0;
    }
  };
}());
