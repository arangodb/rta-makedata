/* global print */

(function () {
  return {
    isSupported: function (version, oldVersion, options, enterprise, cluster) {
      return true;
    },

    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      // All items created must contain dbCount
      print(`${Date()} 000: making per database data ${dbCount}`);
      return 0;
    },
    makeData: function (options, isCluster, isEnterprise, dbCount, loopCount) {
      // All items created must contain dbCount and loopCount
      print(`${Date()} 000: making data ${dbCount} ${loopCount}`);
    },
    makeDataFinalize: function (options, isCluster, isEnterprise, dbCount) {
      // All items created must contain dbCount
      print(`${Date()} 000: finalizing making data ${dbCount}`);
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      // check per DB
      return 0;
    },
    checkData: function (options, isCluster, isEnterprise, dbCount, loopCount, readOnly) {
      print(`${Date()} 000: checking data ${dbCount} ${loopCount}`);
    },
    checkDataFinalize: function (options, isCluster, isEnterprise, dbCount) {
      // full data checking is handled in checkData
      return 0;
    },
    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      // check per DB
      return 0;
    },
    clearData: function (options, isCluster, isEnterprise, dbCount, loopCount) {
      print(`${Date()} 000: clearing data ${dbCount} ${loopCount}`);
    },
    clearDataFinalize: function (options, isCluster, isEnterprise, dbCount) {
      // full data cleanup is handled in cleanData
      return 0;
    }
  };

}());
