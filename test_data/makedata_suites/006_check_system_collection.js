/* global print, db, assertTrue, semver, createSafe, zeroPad */

(function () {
  return {
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      return false; // TODO: re-enable with BTS-1426 fixed
      if(currentVersion.includes("nightly")){
        let version = semver.parse(currentVersion.split('-')[0]);
        return (
          semver.satisfies(oldVersion, '>3.11.2 <3.11.99') &&
            semver.satisfies(currentVersion, '>3.11.2 <3.11.99')
        );
          
      } else {
        return (
          semver.satisfies(oldVersion, '>3.11.1 <3.11.99') &&
            semver.satisfies(currentVersion, '>3.11.1 <3.11.99')
        );
      }
    },
    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      // All items created must contain dbCount
      const dbNameSuffix = "_testPregelSysCol";
      print(`making per database data ${dbCount}`);
      let baseName = database;
      if (baseName === "_system") {
        baseName = "system";
      }
      const databaseName = `${baseName}_${dbCount}${dbNameSuffix}`;
      const created = createSafe(databaseName,
                                 dbname => {
                                   db._flushCache();
                                   db._createDatabase(dbname);
                                   db._useDatabase(dbname);
                                   return true;
                                 }, dbname => {
                                   throw new Error("Creation of database ${databaseName} failed!");
                                 }
                                );
      return 0;
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`checking per database data ${dbCount}`);
      const dbNameSuffix = "_testPregelSysCol";
      const pregelSystemCollectionName = '_pregel_queries';
      {
        let baseName = database;
        if (baseName === "_system") {
          baseName = "system";
        }
        const databaseName = `${baseName}_${dbCount}${dbNameSuffix}`;
        let c = zeroPad(dbCount + options.countOffset);
        db._useDatabase(databaseName);
        print(`Checking availablitty of system collection: ${pregelSystemCollectionName} in database ${databaseName}`);
        assertTrue(db[pregelSystemCollectionName]);
        const properties = db[pregelSystemCollectionName].properties();
        assertTrue(properties.isSystem);
        print(`Verified availability of system collection ${pregelSystemCollectionName} in database ${databaseName}`);
      }
      return 0;
    },
    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      const dbNameSuffix = "_testPregelSysCol";
      print(`clearing per database data ${dbCount}`);
      let baseName = database;
      if (baseName === "_system") {
        baseName = "system";
      }
      const databaseName = `${baseName}_${dbCount}${dbNameSuffix}`;
      db._useDatabase('_system');
      print(`005: dropping ${databaseName}`);
      db._dropDatabase(databaseName);
      return 0;
    }
  };

}());
