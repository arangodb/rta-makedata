/* global print, db, internal, arango */

/* this handler is here to wait for a cluster to have all shard leaders moved away from a stopped node */

(function () {
  return {
    isSupported: function (version, oldVersion, options, enterprise, cluster) {
      return (options.disabledDbserverUUID !== "");
    },
    checkDataDB: function (options, isCluster, isEnterprise, dbCount, readOnly) {
      print(`010: checking data ${dbCount}`);
      let count = 0;
      let databases = db._databases();
      let collections = [];
      let i = 0;
      while (i < databases.length) {
        db._useDatabase(databases[i]);
        let this_db_collections = db._collections().map((c) => c.name());
        let j = 0;
        while (j < this_db_collections.length) {
          collections.push([databases[i], this_db_collections[j]]);
          j++;
        }
        i++;
      }
      let collections_to_move = [];igin/main
      print("010: waiting for all shards on " + options.disabledDbserverUUID + " to be moved");
      while (count < 500) {
        let found = 0;
        collections.forEach((dbcol) => {
          db._useDatabase(dbcol[0]);
          let col = dbcol[1];
          col = dbcol[1]
          let shards = db[col].shards(true);
          Object.values(shards).forEach((serverList) => {
            if (serverList.length > 0 && serverList[0] === options.disabledDbserverUUID) {
              ++found;
              collections_to_move.push(dbcol);
            }
          });
          db._useDatabase("_system");
        });
        if (found > 0) {
          let coldump = ".";
          if ((count + 1 % 25 === 0) || (collections_to_move.length < 10)) {
            coldump = " - " + JSON.stringify(collections_to_move);
          }
          print('010: ' + found + ' found - Waiting' + coldump);
          internal.sleep(1);
          count += 1;
        } else {
          break;
        }
      }
      if (count > 499) {
        let collectionData = "Still have collections bound to the failed server: ";
        collections_to_move.forEach(dbcol => {
          print(dbcol);
          db._useDatabase(dbcol[0]);
          let col = dbcol[1];
          collectionData += "\n" + JSON.stringify(col) + ":\n" +
            JSON.stringify(db[col].shards(true)) + "\n" +
            JSON.stringify(db[col].properties());
          db._useDatabase("_system");
        });
        print(collectionData);
        throw ("010: Still have collections bound to the failed server: " + JSON.stringify(collections_to_move));
      }
      let shardDist = {};
      count = 0;
      print("010: waiting for all new leaders to assume leadership");
      while (count < 500) {
        collections = [];
        let found = 0;
        let shardDist = arango.GET("/_admin/cluster/shardDistribution");
        if (shardDist.code !== 200 || typeof shardDist.results !== "object") {
          continue;
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
              print(s);
              print(col);
              print(ex);
            }
          });
        });
        if (found > 0) {
          print('010: ' + found + ' found - Waiting - ' + JSON.stringify(collections));
          internal.sleep(1);
          count += 1;
        } else {
          break;
        }
      }
      if (count > 499) {
        let collectionData = "Still have collections with incomplete failover: ";
        collections.forEach(col => {
          print(col);
          let shardDistInfoForCol = "";
          if (shardDist.hasOwnProperty("results") &&
            shardDist.results.hasOwnProperty(col)) {
            shardDistInfoForCol = JSON.stringify(shardDist.results[col]);
          }
          collectionData += "\n" + JSON.stringify(col) + ":\n" +
            JSON.stringify(db[col].shards(true)) + "\n" +
            JSON.stringify(db[col].properties()) + "\n" +
            shardDistInfoForCol;
        });
        print(collectionData);
        throw new Error("010: Still have collections with incomplete failover: " + JSON.stringify(collections));
      }

      print("010: done - continuing test.");
      return 0;
    }
  };
}());
