/* global print, db, assertTrue, semver */

(function () {
  return {
    isSupported: function (version, oldVersion, options, enterprise, cluster) {
      // strip off -nightly etc:
      let ver = semver.parse(oldVersion.split('-')[0]);
      return semver.gte(ver, "3.11.0");
    },

    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      return 0;
    },
    makeData: function (options, isCluster, isEnterprise, dbCount, loopCount) {
        return;
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      return 0;
    },
    checkData: function (options, isCluster, isEnterprise, dbCount, loopCount, readOnly) {
      const pregelSystemCollectionName = '_pregel_queries';
      print(`Checking availablitty of system collection: ${pregelSystemCollectionName}`);
      assertTrue(db[pregelSystemCollectionName]);
      const properties = db[pregelSystemCollectionName].properties();
      assertTrue(properties.isSystem);
      print(`Verified availability of system collection: ${pregelSystemCollectionName}`);
    },
    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      return 0;
    },
    clearData: function (options, isCluster, isEnterprise, dbCount, loopCount) {
      return;
    }
  };

}());
