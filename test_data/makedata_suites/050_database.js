/* global arangodb, print,  db, zeroPad, ERRORS, progress, createUseDatabaseSafe  */

(function () {
  return {
    isSupported: function (version, oldVersion, options, enterprise, cluster) {
      return true;
    },

    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      // All items created must contain dbCount
      let localCount = 0;
      if (database !== "_system") {
        print(`${Date()} 050: #ix`);
        db._useDatabase('_system');
        if (db._databases().includes(database)) {
          // its already there - skip this one.
          print(`${Date()} 050: skipping ${database} - its already there.`);
          localCount++;
          return localCount;
        }
        progress(`050: creating database ${database}`);
        let dbcOptions = {};
        if (isCluster && !options.createOneShardDatabase) {
          dbcOptions = { replicationFactor: 2};
        } else if (options.createOneShardDatabase) {
          dbcOptions = { sharding: "single"};
        }
        createUseDatabaseSafe(database, dbcOptions);
      } else if (options.numberOfDBs > 1) {
        throw new Error("must specify a database prefix if want to work with multiple DBs.");
      }
      return localCount;
    },
    makeData: function (options, isCluster, isEnterprise, dbCount, loopCount) {
      // All items created must contain dbCount and loopCount
      print(`${Date()} 050: making data ${dbCount} ${loopCount}`);
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      // check per DB
      if (database !== "_system") {
        db._useDatabase(database);
      } else if (options.numberOfDBs > 1) {
        throw new Error("050: must specify a database prefix if want to work with multiple DBs.");
      }
      return 0;
    },
    checkData: function (options, isCluster, isEnterprise, dbCount, loopCount) {
      print(`${Date()} 050: checking data ${dbCount} ${loopCount}`);
    },
    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      progress(`050: clearing database ${database}`);
      if (database !== "_system") {
        try {
          db._useDatabase('_system');
          db._dropDatabase(database);
        } catch (x) {
          if (x.errorNum === ERRORS.ERROR_ARANGO_DATABASE_NOT_FOUND.code) {
            return 1;
          } else {
            print(`${Date()} 050: ${x}`);
          }
        }
      } else if (options.numberOfDBs > 1) {
        throw new Error("050: must specify a database prefix if want to work with multiple DBs.");
      }
      return 0;
    }
  };
}());
