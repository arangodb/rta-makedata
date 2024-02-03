/* global print, db, assertTrue, semver, createSafe, zeroPad */

(function () {
  return {
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      return false;
      if(currentVersion.includes("nightly")){
        let version = semver.parse(currentVersion.split('-')[0]);
        return semver.satisfies(currentVersion, '>3.11.2 <3.12.0');
      } else {
        return semver.satisfies(currentVersion, '>3.11.1 <3.12.0');
      }
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`checking per database data ${dbCount}`);
      const dbNameSuffix = "_testPregelSysCol";
      const pregelSystemCollectionName = '_pregel_queries';
      {
        print(`Checking availablitty of system collection: ${pregelSystemCollectionName} in database _system`);
        db._useDatabase("_system");
        assertTrue(db[pregelSystemCollectionName]);
        const properties = db[pregelSystemCollectionName].properties();
        assertTrue(properties.isSystem);
        print(`Verified availability of system collection ${pregelSystemCollectionName} in database _system`);
      }

      return 0;
    },
  };

}());
