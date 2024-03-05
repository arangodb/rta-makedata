/* global print,  db, progress, createCollectionSafe, createIndexSafe, time, runAqlQueryResultCount, aql, semver, resetRCount, writeData */

(function () {
  return {
    isSupported: function (version, oldVersion, options, enterprise, cluster) {
      return semver.gt(oldVersion, "3.11.99");
    },
    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      let c_mdi = createCollectionSafe(`c_mdi_${dbCount}`, 3, 2);
      progress('106: createCollection2');
      progress('106: createIndexHash1');
      createIndexSafe({col: c_mdi, type: "mdi", fields: ["Type"], unique: false, fieldValueTypes: 'double'});
    },
    makeData: function (options, isCluster, isEnterprise, dbCount, loopCount) {
      progress(`106: Makedata ${dbCount} ${loopCount}`);
      db._useDatabase('_system');
      let c_mdi = db[`c_mdi_${dbCount}`];

      // Now the actual data writing:
      resetRCount();
      writeData(c_mdi, 1000);
      progress('106: writeData1');
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      print(`checking data ${dbCount}`);
      let cols = db._collections();
      let allFound = true;
      [`c_mdi_${dbCount}`].forEach(colname => {
         let foundOne = false;
         cols.forEach(oneCol => {
           if (oneCol.name() === colname) {
             foundOne = true;
           }
         });
         if (!foundOne) {
           print("106: Didn't find this collection: " + colname);
           allFound = false;
         }
       });
      if (!allFound) {
        throw new Error("106: not all collections were present on the system!");
      }

      let c_mdi = db._collection(`c_mdi_${dbCount}`);

      // Check indexes:
      progress("106: checking indices");

      if (c_mdi.getIndexes().length !== 2 || c_mdi.getIndexes()[1].type !== "mdi") {
        throw new Error(`Banana ${c_mdi.getIndexes().length} `);
      }

      // Check data:
      progress("106: checking data");
      if (c_mdi.count() !== 1000 * options.dataMultiplier) { throw new Error(`Audi ${c_mdi.count()} !== 1000`); }

      // Check a few queries:
      //progress("106: query 1");
      //runAqlQueryResultCount(aql`FOR x IN ${c_mdi} FILTER x.a == "id1001" RETURN x`, 1);
      //progress("106: query 2");
      //runAqlQueryResultCount(aql`FOR x IN ${c_mdi} FILTER x.a == "id10452" RETURN x`, 1);
      //progress("106: queries done");
      progress("106: done");
    },
    clearData: function (options, isCluster, isEnterprise, dbCount, loopCount, readOnly) {
      print(`clearing data ${dbCount} ${loopCount}`);
      progress("106: drop 1");
      try {
        db._drop(`c_mdi_${loopCount}`);
      } catch (e) {}
      progress("106: drop done");
    }
  };
}());
