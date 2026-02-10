/* global print,  db, progress, createCollectionSafe, createIndexSafe, time, runAqlQueryResultCount, aql, semver, resetRCount, writeData */

(function () {
  let secondIndexCreate = false;
  return {
    // hash index is deprecated in 4.0, use 117_vector.js for 4.0+
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      let currentVersionSemver = semver.parse(semver.coerce(currentVersion));
      let oldVersionSemver = semver.parse(semver.coerce(oldVersion));
      secondIndexCreate = (semver.gt(oldVersionSemver, "3.12.5") &&
              semver.gt(currentVersionSemver, "3.12.5"));
      return (semver.gt(oldVersionSemver, "3.12.4") &&
              semver.gt(currentVersionSemver, "3.12.4") &&
              semver.lt(currentVersionSemver, "4.0.0"));
    },
    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      progress('107: createCollection');
      // Only create the collection here - indexes are created in makeData after documents are written
      // because vector indexes require documents to be present for training
      createCollectionSafe(`c_vector_${dbCount}`, 3, 2);
    },
    makeData: function (options, isCluster, isEnterprise, dbCount, loopCount) {
      progress(`107: Makedata ${dbCount} ${loopCount}`);
      let c_vector = db[`c_vector_${dbCount}`];

      // Write data first
      resetRCount();
      writeData(c_vector, 1000);

      progress('107: writeData1');
    },
    makeDataFinalize: function (options, isCluster, isEnterprise, dbCount) {
      progress('107: createIndex');
      let c_vector = db[`c_vector_${dbCount}`];
      // Create indexes after data is written (vector indexes need documents for training)
      if (c_vector.indexes().length === 1) {
        progress('107: createIndexVector');
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
        if (secondIndexCreate) {
          print('107: creating hash index');
          createIndexSafe({col: c_vector, type: "hash", fields: ["a"], unique: false});
        }
      }
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      print(`${Date()} 107: checking data ${dbCount}`);
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
           print(`${Date()} 107: Didn't find this collection: ${colname}`);
           allFound = false;
         }
       });
      if (!allFound) {
        throw new Error("107: not all collections were present on the system!");
      }

      let c_vector = db._collection(`c_vector_${dbCount}`);

      // Check indexes:
      progress("107: checking indices");

      const indexExpectCount = (secondIndexCreate) ? 3 : 2;
      if (c_vector.getIndexes().length !== indexExpectCount || c_vector.getIndexes()[1].type !== "vector") {
        throw new Error(`Banana ${c_vector.getIndexes().length} `);
      }

      // Check data:
      progress("107: checking data");
      if (c_vector.count() !== 1000 * options.dataMultiplier) { throw new Error(`Audi ${c_vector.count()} !== 1000`); }

      // Check a few queries:
      progress("107: query 1");
      runAqlQueryResultCount(aql`
           FOR d IN ${c_vector}
               SORT APPROX_NEAR_L2(d.TypeVec,  [1,2,3,4,5], {nProbe: 5})
                 LIMIT 5 RETURN d`, 5);
      progress("107: queries done");
      progress("107: done");
    },
    clearData: function (options, isCluster, isEnterprise, dbCount, loopCount, readOnly) {
      print(`${Date()} 107: clearing data ${dbCount} ${loopCount}`);
      progress("107: drop 1");
      try {
        db._drop(`c_vector_${loopCount}`);
      } catch (ex) {}
      progress("107: drop done");
    }
  };
}());
