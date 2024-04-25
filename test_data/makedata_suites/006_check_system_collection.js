/* global print, db, assertTrue, semver, createSafe, zeroPad, createUseDatabaseSafe */

(function () {
  return {
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
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
      print(`006: making per database data ${dbCount}`);
      let baseName = database;
      if (baseName === "_system") {
        baseName = "system";
      } else {
        print(`006: skipping creation of per database data, since database is not _system`);
        return 0;
      }
      const databaseName = `${baseName}_${dbCount}${dbNameSuffix}`;
      createUseDatabaseSafe(databaseName, {});
      return 0;
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`006: checking per database data ${dbCount}`);
      const dbNameSuffix = "_testPregelSysCol";
      const pregelSystemCollectionName = '_pregel_queries';
      {
        let baseName = database;
        if (baseName === "_system") {
          baseName = "system";
        } else {
          print(`006: skipping checking of per database data, since database is not _system`);
          return 0;
        }
        const databaseName = `${baseName}_${dbCount}${dbNameSuffix}`;
        let c = zeroPad(dbCount + options.countOffset);
        db._useDatabase(databaseName);
        print(`006: Checking availablitty of system collection: ${pregelSystemCollectionName} in database ${databaseName}`);
        assertTrue(db[pregelSystemCollectionName]);
        const properties = db[pregelSystemCollectionName].properties();
        assertTrue(properties.isSystem);
        print(`006: Verified availability of system collection ${pregelSystemCollectionName} in database ${databaseName}`);
      }
      return 0;
    },
    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      const dbNameSuffix = "_testPregelSysCol";
      print(`006: clearing per database data ${dbCount}`);
      let baseName = database;
      if (baseName === "_system") {
        baseName = "system";
      } else {
        print(`006: skipping deletion of per database data, since database is not _system`);
        return 0;
      }
      const databaseName = `${baseName}_${dbCount}${dbNameSuffix}`;
      db._useDatabase('_system');
      print(`006: dropping ${databaseName}`);
      db._dropDatabase(databaseName);
      return 0;
    }
  };

}());
