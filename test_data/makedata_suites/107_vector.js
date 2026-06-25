/* global print,  db, progress, createCollectionSafe, createIndexSafe, time, runAqlQueryResultCount, aql, semver, resetRCount, writeData, vectorIndexTrainsInBackground */

(function () {
  let secondIndexCreate = false;
  // Kept small so the (foreground) index build on pre-3.12.10 clusters finishes
  // well within the test harness timeout; nLists is 1, so this is ample.
  const VECTOR_DOC_COUNT = 100;
  return {
    // hash index is deprecated in 4.0, use 117_vector.js for 4.0+
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      if (!options.testVector) {
	return false;
      }
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
      writeData(c_vector, VECTOR_DOC_COUNT);

      progress('107: writeData1');
    },
    makeDataFinalize: function (options, isCluster, isEnterprise, dbCount) {
      progress('107: createIndex');
      let c_vector = db[`c_vector_${dbCount}`];
      // Create indexes after data is written (vector indexes need documents for training)
      if (c_vector.indexes().length === 1) {
        // Always build in the background: a foreground build on a pre-3.12.10
        // cluster blocks long enough (fixed per-index overhead) to trip the test
        // harness timeout, while a background build returns immediately.
        const inBackground = true;
        print(`107: creating vector index (version=${options.curVersion}, isCluster=${isCluster}, inBackground=${inBackground}) with data distribution ${JSON.stringify(c_vector.count(true))}`);
        try {
          const start = time();
          c_vector.ensureIndex({
            name: `i_vector_dbcount`,
            type: "vector",
            fields: ["TypeVec"],
            inBackground: inBackground,
            params: {
              metric: "l2",
              dimension: 5,
              nLists: 1
            },
          });
          print(`107: vector index created in ${time() - start}s, state: ${JSON.stringify(c_vector.getIndexes().filter(idx => idx.type === "vector"))}`);
          if (secondIndexCreate) {
            print('107: creating hash index');
            createIndexSafe({col: c_vector, type: "hash", fields: ["a"], unique: false});
          }
        } catch(e) {
          print(`107: error when creating vector index: ${e}`);
          print(`107: Indexes state: ${JSON.stringify(c_vector.indexes())}`);
          throw e;
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
        throw new Error(`Banana ${c_vector.getIndexes().length} indexes: ${JSON.stringify(c_vector.getIndexes())}`);
      }

      // Check data:
      progress("107: checking data");
      if (c_vector.count() !== VECTOR_DOC_COUNT * options.dataMultiplier) { throw new Error(`Audi ${c_vector.count()} !== ${VECTOR_DOC_COUNT * options.dataMultiplier}`); }

      // The vector index is built in the background; on a pre-3.12.10 cluster it
      // never finishes training and an untrained index cannot be queried. Only
      // from 3.12.10 / 4.0 on does an untrained index answer queries (linear-scan
      // fallback), so run the vector query only there.
      if (vectorIndexTrainsInBackground(options.curVersion)) {
        progress("107: query 1");
        runAqlQueryResultCount(aql`
             FOR d IN ${c_vector}
                 SORT APPROX_NEAR_L2(d.TypeVec,  [1,2,3,4,5], {nProbe: 5})
                   LIMIT 5 RETURN d`, 5);
        progress("107: queries done");
      }
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
