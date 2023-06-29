/* global print */

(function () {
  return {
    isSupported: function (version, oldVersion, options, enterprise, cluster) {
      return true;
    },

    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      // All items created must contain dbCount
      print(`000: making per database data ${dbCount}`);
      return 0;
    },
    makeData: function (options, isCluster, isEnterprise, dbCount, loopCount) {
      // All items created must contain dbCount and loopCount
      print(`000: making data ${dbCount} ${loopCount}`);
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      // check per DB
      return 0;
    },
    checkData: function (options, isCluster, isEnterprise, dbCount, loopCount, readOnly) {
      print(`000: checking data ${dbCount} ${loopCount}`);
    },
    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      // check per DB
      return 0;
    },
    clearData: function (options, isCluster, isEnterprise, dbCount, loopCount) {
      print(`000: checking data ${dbCount} ${loopCount}`);
    }
  };

}());
