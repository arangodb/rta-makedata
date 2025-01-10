/* global print,  db, progress, createCollectionSafe, createIndexSafe, time, runAqlQueryResultCount, aql, semver, resetRCount, writeData */

(function () {
  return {
    isSupported: function (version, oldVersion, options, enterprise, cluster) {
      return true;
    },
    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      let c_vector = createCollectionSafe(`c_vector_${dbCount}`, 3, 2);
      progress('107: createCollection2');
      progress('107: createIndexHash1');
      createIndexSafe({
        col: c_vector,
        type: "vector",
        fields: ["Type"],
        inBackground: false,
        params: {
          metric: "l2",
          dimension: 500,
          nLists: 1
        },
      });
    },
    makeData: function (options, isCluster, isEnterprise, dbCount, loopCount) {
      progress(`107: Makedata ${dbCount} ${loopCount}`);
      let c_vector = db[`c_vector_${dbCount}`];

      // Now the actual data writing:
      resetRCount();
      writeData(c_vector, 1000);
      print('xxxx')
      print(c_vector.count())
      progress('107: writeData1');
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

      if (c_vector.getIndexes().length !== 2 || c_vector.getIndexes()[1].type !== "vector") {
        throw new Error(`Banana ${c_vector.getIndexes().length} `);
      }

      // Check data:
      progress("107: checking data");
      if (c_vector.count() !== 1000 * options.dataMultiplier) { throw new Error(`Audi ${c_vector.count()} !== 1000`); }

      // Check a few queries:
      //progress("107: query 1");
      runAqlQueryResultCount(aql`"FOR d IN ${c_vector.name}
                 SORT APPROX_NEAR_L2(d.Type, 777, {nProbe: 10}) 
                LIMIT 5 RETURN d`);
      // Check a few queries:
      //progress("107: query 1");
      //runAqlQueryResultCount(aql`FOR x IN ${c_vector} FILTER x.a == "id1001" RETURN x`, 1);
      //progress("107: query 2");
      //runAqlQueryResultCount(aql`FOR x IN ${c_vector} FILTER x.a == "id10452" RETURN x`, 1);
      //progress("107: queries done");
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
