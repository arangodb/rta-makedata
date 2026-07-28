/* global print,  db, progress, createCollectionSafe, createIndexSafe, time, runAqlQueryResultCount, aql, semver, resetRCount, writeData, waitForVectorIndexTrained */

(function () {
  // Small data set keeps the suite fast; the build is quick regardless. nLists
  // is 1, so 100 docs is far above the per-index training-data minimum (nLists).
  const VECTOR_DOC_COUNT = 100;
  return {
    // Single vector-index suite for 3.12.9+ and 4.0+. Uses a persistent
    // secondary index (works on both 3.12 and 4.0 and survives upgrades), so no
    // separate 4.0 variant is needed.
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      if (!options.testVector) {
	return false;
      }
      let currentVersionSemver = semver.parse(semver.coerce(currentVersion));
      let oldVersionSemver = semver.parse(semver.coerce(oldVersion));
      // Require 3.12.9+: the first version exposing the vector index's
      // trainingState, so we can wait for the index and then reliably verify
      // data + index + query. No upper bound — runs on 4.0+ as well.
      return (semver.gte(oldVersionSemver, "3.12.9") &&
              semver.gte(currentVersionSemver, "3.12.9"));
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
        const inBackground = false;
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
          print('107: creating persistent index');
          createIndexSafe({col: c_vector, type: "persistent", fields: ["a"], unique: false});
        } catch(e) {
          print(`107: error when creating vector index: ${e}`);
          print(`107: Indexes state: ${JSON.stringify(c_vector.indexes())}`);
          throw e;
        }
      }
    },

    waitDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      let c_vector = db._collection(`c_vector_${dbCount}`);
      // The index is created in the foreground (inBackground: false), so
      // ensureIndex only returns once it is present. Still wait for training to
      // finish before checking/querying (printing periodically so the harness
      // no-output watchdog does not kill the otherwise-silent wait).
      progress("107: waiting for vector index to be trained");
      waitForVectorIndexTrained(c_vector);
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

      // 1) the index is present (primary + vector + persistent = 3):
      progress("107: checking indices");
      if (c_vector.getIndexes().length !== 3 || c_vector.getIndexes()[1].type !== "vector") {
        throw new Error(`Banana ${c_vector.getIndexes().length} indexes: ${JSON.stringify(c_vector.getIndexes())}`);
      }

      // 2) the data is present:
      progress("107: checking data");
      if (c_vector.count() !== VECTOR_DOC_COUNT * options.dataMultiplier) { throw new Error(`Audi ${c_vector.count()} !== ${VECTOR_DOC_COUNT * options.dataMultiplier}`); }

      // 3) the index can be queried:
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
