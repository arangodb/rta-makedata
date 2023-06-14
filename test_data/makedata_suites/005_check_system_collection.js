/* global print, db, assertTrue, semver, createSafe, zeroPad */

(function () {
  return {
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      if(currentVersion.includes("nightly")){
        let version = semver.parse(currentVersion.split('-')[0]);
        return semver.satisfies(currentVersion, '>3.11.2 <3.12.0 || >=3.12.1');
      } else {
        return semver.satisfies(currentVersion, '>3.11.1 <3.12.0 || >=3.12.0');
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
    makeData: function (options, isCluster, isEnterprise, dbCount, loopCount) {
        return;
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      const dbNameSuffix = "_testPregelSysCol";
      print(`checking per database data ${dbCount}`);
      let baseName = database;
      if (baseName === "_system") {
        baseName = "system";
      }
      const databaseName = `${baseName}_${dbCount}${dbNameSuffix}`;
      const pregelSystemCollectionName = '_pregel_queries';
      let c = zeroPad(dbCount + options.countOffset);
      db._useDatabase(databaseName);

      print(`Checking availablitty of system collection: ${pregelSystemCollectionName} in database ${databaseName}`);
      assertTrue(db[pregelSystemCollectionName]);
      const properties = db[pregelSystemCollectionName].properties();
      assertTrue(properties.isSystem);
      print(`Verified availability of system collection ${pregelSystemCollectionName} in database ${databaseName}`);
      return 0;
    },
    checkData: function (options, isCluster, isEnterprise, dbCount, loopCount, readOnly) {
      const pregelSystemCollectionName = '_pregel_queries';
      let databaseName = "_system";
      db._useDatabase(databaseName);
      print(`Checking availablitty of system collection: ${pregelSystemCollectionName} in database ${databaseName}`);
      assertTrue(db[pregelSystemCollectionName]);
      const properties = db[pregelSystemCollectionName].properties();
      assertTrue(properties.isSystem);
      print(`Verified availability of system collection ${pregelSystemCollectionName} in database ${databaseName}`);
      return;
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
    },
    clearData: function (options, isCluster, isEnterprise, dbCount, loopCount) {
      return;
    }
  };

}());
