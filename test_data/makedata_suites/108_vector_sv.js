/* global print,  db, progress, createCollectionSafe, createIndexSafe, time, runAqlQueryResultCount, aql, semver, resetRCount, randomInteger, randomNumberGeneratorFloat */

(function () {
  return {
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
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
      progress(`108: Makedata ${dbCount} ${loopCount}`);
      let c_vector_sv = db[`c_vector_sv_${dbCount}`];
      const docNumber = 1000;

      // Fill collection with documents:
      let docs = [];
      let gen = randomNumberGeneratorFloat(randomInteger());
      
      for (let i = 0; i < docNumber * options.dataMultiplier; ++i) {
        const vector = Array.from({ length: 20}, () => gen());
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
      // create vector index with stored values
      progress('108: createIndex');
      if (c_vector_sv.indexes().length === 1) {
        print('108: creating vector index with stored values');
        createIndexSafe({
          col: c_vector_sv,
          name: `vector_l2_stored`,
          type: "vector",
          fields: ["vector"],
          inBackground: false,
          storedValues: ["val", "stringField", "boolField", "floatField"],
          params: {
            metric: "l2",
            dimension: 20,
            nLists: 10,
            trainingIterations: 10,
            defaultNProbe: 10
          }
        });
      }
      progress('108: writeData1');
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
        throw new Error(`Banana ${c_vector_sv.getIndexes().length} `);
      }

      // Check data:
      progress("108: checking data");
      if (c_vector_sv.count() !== 1000 * options.dataMultiplier) { throw new Error(`Audi ${c_vector_sv.count()} !== 1000`); }

      // Check a few queries:
      progress("108: query 1");
      if (options.dataMultiplier === 1) {
        runAqlQueryResultCount(aql`
          LET rp = (
            FOR d IN ${c_vector_sv}
            FILTER d.val == 500
            RETURN d.vector
          )
          FOR d IN ${c_vector_sv}
            FILTER d.val < 5 AND d.stringField == 'type_A'
            LET dist = APPROX_NEAR_L2(FLATTEN(rp), d.vector)
            SORT dist LIMIT 5
            RETURN {key: d._key, val: d.val, stringField: d.stringField, dist}`, 2);
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