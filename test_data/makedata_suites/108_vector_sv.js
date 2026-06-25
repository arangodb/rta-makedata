/* global print,  db, progress, createCollectionSafe, createIndexSafe, time, runAqlQueryResultCount, aql, semver, resetRCount, vectorIndexTrainsInBackground */

(function () {
  // Kept small so the (foreground) index build on pre-3.12.10 clusters finishes
  // well within the test harness timeout; nLists is 10, so this is ample.
  const VECTOR_DOC_COUNT = 100;
  return {
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      if (!options.testVector) {
	return false;
      }
      let currentVersionSemver = semver.parse(semver.coerce(currentVersion));
      let oldVersionSemver = semver.parse(semver.coerce(oldVersion));
      return (semver.gte(oldVersionSemver, "3.12.7") &&
          semver.gte(currentVersionSemver, "3.12.7"));
    },
    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      progress('108: createCollection');
      createCollectionSafe(`c_vector_sv_${dbCount}`, 3, 2);
    },
    makeData: function (options, isCluster, isEnterprise, dbCount, loopCount) {
      const {
        randomNumberGeneratorFloat,
        randomInteger
      } = require("@arangodb/testutils/seededRandom");
      progress(`108: Makedata ${dbCount} ${loopCount}`);
      let c_vector_sv = db[`c_vector_sv_${dbCount}`];
      const docNumber = VECTOR_DOC_COUNT;

      // Fill collection with documents:
      let docs = [];
      const seed = randomInteger();
      let gen = randomNumberGeneratorFloat(seed);

      for (let i = 0; i < docNumber * options.dataMultiplier; ++i) {
        const vector = Array.from({length: 20}, () => gen());
        docs.push({
          vector,
          val: i,
          nonStoredValue: i * 2,
          stringField: i % 3 === 0 ? "type_A" : (i % 3 === 1 ? "type_B" : "type_C"),
          boolField: i % 2 === 0,
          arrayField: [i % 5, i % 7],
          objectField: {
            nested: i % 4,
            category: i < docNumber / 2 ? "first_half" : "second_half"
          },
          floatField: i + 0.5
        });
      }
      c_vector_sv.insert(docs);
      progress('108: writeData1');
    },
    makeDataFinalize: function (options, isCluster, isEnterprise, dbCount) {
      progress('108: createIndex');
      let c_vector_sv = db[`c_vector_sv_${dbCount}`];
      if (c_vector_sv.indexes().length === 1) {
        // Always build in the background: a foreground build on a pre-3.12.10
        // cluster blocks long enough (fixed per-index overhead) to trip the test
        // harness timeout, while a background build returns immediately.
        const inBackground = true;
        print(`108: creating vector index with stored values (version=${options.curVersion}, isCluster=${isCluster}, inBackground=${inBackground}) with data distribution ${JSON.stringify(c_vector_sv.count(true))}`);
        try {
          const start = time();
          c_vector_sv.ensureIndex({
            name: `vector_l2_stored`,
            type: "vector",
            fields: ["vector"],
            inBackground: inBackground,
            storedValues: ["val", "stringField", "boolField", "floatField"],
            params: {
              metric: "l2",
              dimension: 20,
              nLists: 10,
              trainingIterations: 10,
              defaultNProbe: 10
            }
          });
          print(`108: vector index created in ${time() - start}s, state: ${JSON.stringify(c_vector_sv.getIndexes().filter(idx => idx.type === "vector"))}`);
        } catch(e) {
          print(`108: error when creating vector index with stored values with error: ${e}`);
          print(`108: Indexes state: ${JSON.stringify(c_vector_sv.indexes())}`);
          throw e;
        }
      }
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      print(`${Date()} 108: checking data ${dbCount}`);
      let cols = db._collections();
      let allFound = true;
      [`c_vector_sv_${dbCount}`].forEach(colname => {
        let foundOne = false;
        cols.forEach(oneCol => {
          if (oneCol.name() === colname) {
            foundOne = true;
          }
        });
        if (!foundOne) {
          print(`${Date()} 108: Didn't find this collection: ${colname}`);
          allFound = false;
        }
      });
      if (!allFound) {
        throw new Error("108: not all collections were present on the system!");
      }

      let c_vector_sv = db._collection(`c_vector_sv_${dbCount}`);

      // Check indexes:
      progress("108: checking indices");

      let indexExpectCount = 2;

      if (c_vector_sv.getIndexes().length !== indexExpectCount || c_vector_sv.getIndexes()[1].type !== "vector") {
        throw new Error(`Banana ${c_vector_sv.getIndexes().length} indexes: ${JSON.stringify(c_vector_sv.getIndexes())}`);
      }

      // Check data:
      progress("108: checking data");
      if (c_vector_sv.count() !== VECTOR_DOC_COUNT * options.dataMultiplier) { throw new Error(`Audi ${c_vector_sv.count()} !== ${VECTOR_DOC_COUNT * options.dataMultiplier}`); }

      // The vector index is built in the background; on a pre-3.12.10 cluster it
      // never finishes training and an untrained index cannot be queried. Only
      // from 3.12.10 / 4.0 on does an untrained index answer queries (linear-scan
      // fallback), so run the vector query only there.
      progress("108: query 1");
      if (vectorIndexTrainsInBackground(options.curVersion) && options.dataMultiplier === 1) {
        runAqlQueryResultCount(aql`
          LET rp = (
            FOR d IN ${c_vector_sv}
            FILTER d.val == ${VECTOR_DOC_COUNT / 2}
            RETURN d.vector
          )
          FOR d IN ${c_vector_sv}
            FILTER d.val < 250 AND d.stringField == 'type_A'
            LET dist = APPROX_NEAR_L2(FLATTEN(rp), d.vector, {nProbe: 10})
            SORT dist LIMIT 5
            RETURN {key: d._key, val: d.val, stringField: d.stringField, dist}`, 5);
      }
      progress("108: queries done");
      progress("108: done");
    },
    clearData: function (options, isCluster, isEnterprise, dbCount, loopCount, readOnly) {
      print(`${Date()} 108: clearing data ${dbCount} ${loopCount}`);
      progress("108: drop 1");
      try {
        db._drop(`c_vector_sv_${loopCount}`);
      } catch (ex) {}
      progress("108: drop done");
    }
  };
}());
