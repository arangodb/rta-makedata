/* global print, db, progress, createCollectionSafe, createIndexSafe, time, runAqlQueryResultCount, aql, semver, resetRCount, writeData */

// This is the ArangoDB 4.0+ version of 107_vector.js
// Uses persistent instead of hash for secondary index

(function () {
  return {
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      let currentVersionSemver = semver.parse(semver.coerce(currentVersion));
      return semver.gte(currentVersionSemver, "4.0.0");
    },
    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      progress('117: createCollection');
      let c_vector = createCollectionSafe(`c_vector_${dbCount}`, 3, 2);

      // Create indexes in makeDataDB (called once per dbCount)
      progress('117: createIndexVector');
      createIndexSafe({
        col: c_vector,
        name: `i_vector_dbcount`,
        type: "vector",
        fields: ["TypeVec"],
        inBackground: false,
        params: {
          metric: "l2",
          dimension: 5,
          nLists: 1
        },
      });
      print('117: creating persistent index');
      createIndexSafe({col: c_vector, type: "persistent", fields: ["a"], unique: false});
    },
    makeData: function (options, isCluster, isEnterprise, dbCount, loopCount) {
      progress(`117: Makedata ${dbCount} ${loopCount}`);
      let c_vector = db[`c_vector_${dbCount}`];

      // Only data writing here (called per dbCount AND loopCount)
      resetRCount();
      writeData(c_vector, 1000);
      progress('117: writeData1');
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      print(`${Date()} 117: checking data ${dbCount}`);
      let cols = db._collections();
      let allFound = true;
      [`c_vector_${dbCount}`].forEach(colname => {
         let foundOne = false;
         cols.forEach(oneCol => {
           if (oneCol.name() === colname) {
             foundOne = true;
           }
         });
         if (!foundOne) {
           print(`${Date()} 117: Didn't find this collection: ${colname}`);
           allFound = false;
         }
       });
      if (!allFound) {
        throw new Error("117: not all collections were present on the system!");
      }

      let c_vector = db._collection(`c_vector_${dbCount}`);

      // Check indexes (vector + persistent = 3 including primary):
      progress("117: checking indices");

      if (c_vector.getIndexes().length !== 3 || c_vector.getIndexes()[1].type !== "vector") {
        throw new Error(`Banana ${c_vector.getIndexes().length} `);
      }

      // Check data:
      progress("117: checking data");
      if (c_vector.count() !== 1000 * options.dataMultiplier) { throw new Error(`Audi ${c_vector.count()} !== 1000`); }

      // Check a few queries:
      progress("117: query 1");
      runAqlQueryResultCount(aql`
           FOR d IN ${c_vector}
               SORT APPROX_NEAR_L2(d.TypeVec,  [1,2,3,4,5], {nProbe: 5})
                 LIMIT 5 RETURN d`, 5);
      progress("117: queries done");
      progress("117: done");
    },
    clearData: function (options, isCluster, isEnterprise, dbCount, loopCount, readOnly) {
      print(`${Date()} 117: clearing data ${dbCount} ${loopCount}`);
      progress("117: drop 1");
      try {
        db._drop(`c_vector_${loopCount}`);
      } catch (ex) {}
      progress("117: drop done");
    }
  };
}());
