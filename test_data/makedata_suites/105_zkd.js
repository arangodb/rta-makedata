/* global print,  db, progress, createCollectionSafe, createIndexSafe, time, runAqlQueryResultCount, aql, semver, resetRCount, writeData, _, */

(function () {
  return {
    isSupported: function (version, oldVersion, options, enterprise, cluster) {
      return semver.gt(oldVersion, "3.10.0");
    },
    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      // All items created must contain dbCount and loopCount
      // Create a few collections:
      let c_zkd = createCollectionSafe(`c_zkd_${dbCount}`, 3, 2);
      progress('105: createCollection1');
      // Create some indexes:
      progress('105: createCollection2');
      createIndexSafe({col: c_zkd, type: "zkd", fields: ["Type"], unique: false, fieldValueTypes: 'double'});
    },
    makeData: function (options, isCluster, isEnterprise, dbCount, loopCount) {
      progress(`105: Makedata ${dbCount} ${loopCount}`);
      let c_zkd = db[`c_zkd_${dbCount}`];

      // Now the actual data writing:
      resetRCount();
      writeData(c_zkd, 1000);
      progress('105: writeData1');
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      print(`checking data ${dbCount}`);
      let cols = db._collections();
      let allFound = true;
      [`c_zkd_${dbCount}`].forEach(colname => {
         let foundOne = false;
         cols.forEach(oneCol => {
           if (oneCol.name() === colname) {
             foundOne = true;
           }
         });
         if (!foundOne) {
           print("105: Didn't find this collection: " + colname);
           allFound = false;
         }
       });
      if (!allFound) {
        throw new Error("105: not all collections were present on the system!");
      }

      let c_zkd = db[`c_zkd_${dbCount}`];

      // Check indexes:
      progress("105: checking indices");

      if (c_zkd.getIndexes().length !== 2 || c_zkd.getIndexes()[1].type !== "zkd") {
        throw new Error(`Banana ${JSON.stringify(c_zkd.getIndexes())}`);
      }

      // Check data:
      progress("105: checking data");
      if (c_zkd.count() !== 1000 * options.dataMultiplier) { throw new Error(`Audi ${c_zkd.count()} !== 1000`); }

      // // Check a few queries:
      // progress("105: query 1");
      // runAqlQueryResultCount(aql`FOR x IN ${c_zkd} FILTER x.a == "id1001" RETURN x`, 1);
      // progress("105: query 2");
      // runAqlQueryResultCount(aql`FOR x IN ${c_zkd} FILTER x.a == "id10452" RETURN x`, 1);
      progress("105: done");
    },
    clearData: function (options, isCluster, isEnterprise, dbCount, loopCount, readOnly) {
      print(`clearing data ${dbCount} ${loopCount}`);
      progress("105: drop 1");
      try {
        db._drop(`c_zkd_${dbCount}`);
      } catch (e) {}
    }
  };
}());
