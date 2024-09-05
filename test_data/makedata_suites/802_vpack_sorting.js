/* global print, db, progress, createCollectionSafe, createIndexSafe, time, runAqlQueryResultCount, aql, resetRCount, writeData */

(function () {
  return {
    isSupported: function (version, oldVersion, options, enterprise, cluster) {
      return true; // Assuming VPack sorting migration is supported in all environments
    },
    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`802: VPack Sorting making per database data ${dbCount}`);
      let c = createCollectionSafe(`vpack_sorting_c_${dbCount}`, 3, 2);
      progress('802: createSortingCollection');
      
      // Create index:
      progress('802: createSortingIndex');
      createIndexSafe({col: c, type: "persistent", fields: ["value"]});
    },
    makeData: function (options, isCluster, isEnterprise, dbCount, loopCount) {
      print(`802: VPack Sorting making data ${dbCount} ${loopCount}`);
      let c = db[`vpack_sorting_c_${dbCount}`];

      // Insert test data:
      progress('802: inserting test data');
      db._query(aql`
        INSERT { _key: "1", value: [1152921504606846976, "z"] } INTO ${c}
      `);
      db._query(aql`
        INSERT { _key: "2", value: [1152921504606846977, "x"] } INTO ${c}
      `);
      db._query(aql`
        INSERT { _key: "3", value: [1.152921504606847e+18, "y"] } INTO ${c}
      `);
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      print(`802: VPack Sorting checking per database data ${dbCount}`);
      let c = db._collection(`vpack_sorting_c_${dbCount}`);

      // Check sorting before fix:
      progress("802: checking sorting before fix");
      let resultBeforeFix = db._query(aql`FOR doc IN ${c} SORT doc.value RETURN doc`).toArray();
      print("Sorting before fix:", JSON.stringify(resultBeforeFix));

      // Skip the migration for now
      progress("802: Skipping VPack sorting migration for debugging purposes");

      // Check sorting after skipping fix:
      progress("802: checking sorting after skipping fix");
      let resultAfterFix = db._query(aql`FOR doc IN ${c} SORT doc.value RETURN doc`).toArray();
      print("Sorting after skipping fix:", JSON.stringify(resultAfterFix));
    },
    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`802: VPack Sorting clearing per database data ${dbCount}`);
      try {
        db._drop(`vpack_sorting_c_${dbCount}`);
      } catch (e) {}
    },
    clearData: function (options, isCluster, isEnterprise, dbCount, loopCount) {
      print(`802: VPack Sorting clearing data ${dbCount} ${loopCount}`);
      try {
        db._drop(`vpack_sorting_c_${loopCount}`);
      } catch (e) {}
    }
  };
}());
