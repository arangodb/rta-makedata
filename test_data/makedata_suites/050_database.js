/* global arangodb, print,  db, zeroPad, createSafe, ERRORS, databaseName, createSafe,progress  */

(function () {
  return {
    isSupported: function (version, oldVersion, options, enterprise, cluster) {
      return true;
    },

    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      // All items created must contain dbCount
      let localCount = 0;
      if (database !== "_system") {
        print('050: #ix');
        let c = zeroPad(localCount + dbCount + options.countOffset);
        let databaseName = `${database}_${c}`; // TODO: global variable :/
        if (db._databases().includes(databaseName)) {
          // its already there - skip this one.
          print(`050: skipping ${databaseName} - its already there.`);
          localCount++;
          return localCount;
        }
        progress(`050: creating database ${databaseName}`);
        createSafe(databaseName,
                   dbname => {
                     db._flushCache();
                     db._createDatabase(dbname);
                     return db._useDatabase(dbname);
                   }, dbname => {
                     return db._useDatabase(databaseName);
                   }
                  );
      } else if (options.numberOfDBs > 1) {
        throw new Error("must specify a database prefix if want to work with multiple DBs.");
      }
      return localCount;
    },
    makeData: function (options, isCluster, isEnterprise, dbCount, loopCount) {
      // All items created must contain dbCount and loopCount
      print(`050: making data ${dbCount} ${loopCount}`);
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      // check per DB
      if (database !== "_system") {
        let c = zeroPad(dbCount + options.countOffset);
        let databaseName = `${database}_${c}`; // TODO: global variable :/
        progress(`050: using database ${databaseName}`);
        db._useDatabase(databaseName);
      } else if (options.numberOfDBs > 1) {
        throw new Error("050: must specify a database prefix if want to work with multiple DBs.");
      }
      return 0;
    },
    checkData: function (options, isCluster, isEnterprise, dbCount, loopCount) {
      print(`050: checking data ${dbCount} ${loopCount}`);
    },
    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      if (database !== "_system") {
        let c = zeroPad(dbCount + options.countOffset);
        let databaseName = `${database}_${c}`; // TODO: global variable :/
        try {
          db._useDatabase(databaseName);
        } catch (x) {
          if (x.errorNum === ERRORS.ERROR_ARANGO_DATABASE_NOT_FOUND.code) {
            return 1;
          } else {
            print(`050: ${x}`);
          }
        }
      } else if (options.numberOfDBs > 1) {
        throw new Error("050: must specify a database prefix if want to work with multiple DBs.");
      }
      return 0;
    }
  };
}());
