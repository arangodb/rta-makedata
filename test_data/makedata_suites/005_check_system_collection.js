/* global print, db, assertTrue, semver */

(function () {
  return {
    isSupported: function (version, oldVersion, options, enterprise, cluster) {
      // strip off -nightly etc:
      //let ver = semver.parse(oldVersion.split('-')[0]);
      return semver.gte(ver, "3.11.0");
    },

    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      // All items created must contain dbCount
      print(`making per database data ${dbCount}`);
      return 0;
    },
    makeData: function (options, isCluster, isEnterprise, dbCount, loopCount) {
      // All items created must contain dbCount and loopCount
      print(`making data ${dbCount} ${loopCount}`);
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      // check per DB
      return 0;
    },
    checkData: function (options, isCluster, isEnterprise, dbCount, loopCount, readOnly) {
      const pregelSystemCollectionName = '_pregel_queries';
      print(`Checking availablitty of system collection: ${pregelSystemCollectionName}`);
      assertTrue(db[pregelSystemCollectionName]);
      const properties = db[pregelSystemCollectionName].properties();
      assertTrue(properties.isSystem);
      print(`Verified availability of system collection: ${pregelSystemCollectionName}`);
      //print(`checking data ${dbCount} ${loopCount}`);
    },
    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      // check per DB
      return 0;
    },
    clearData: function (options, isCluster, isEnterprise, dbCount, loopCount) {
      //print(`checking data ${dbCount} ${loopCount}`);
    }
  };

}());
