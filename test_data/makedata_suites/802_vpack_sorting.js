/* global print, db, progress, createCollectionSafe, createIndexSafe, time, runAqlQueryResultCount, aql, resetRCount, writeData */

(function () {
  return {
    isSupported: function (version, oldVersion, options, enterprise, cluster) {
      return true; // Support all versions to handle both cases within the test
    },
    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`802: VPack Sorting making per database data ${dbCount}`);
      let c = createCollectionSafe(`vpack_sorting_c_${dbCount}`, 3, 2);
      progress('802: createSortingCollection');
      
      // Create persistence index:
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

      const version = db._version();
      const currentVersionSemver = semver.parse(semver.coerce(version));
      const minVersionSemver = semver.parse(semver.coerce("3.12.2"));
      const fallbackVersionSemver = semver.parse(semver.coerce("3.11.11"));

      // Check sorting before migration
      progress("802: checking sorting before migration");
      let resultBeforeFix = db._query(aql`FOR doc IN ${c} SORT doc.value RETURN { _key: doc._key, value: doc.value }`).toArray(); // Return only _key and value
      
      print("Actual sorting result:", JSON.stringify(resultBeforeFix, null, 2));

      if (semver.lt(currentVersionSemver, fallbackVersionSemver) && semver.lt(currentVersionSemver, minVersionSemver)) {
        // For versions older than 3.11.11 and 3.12.2, check the incorrect sorting order (z, x, y)
        print("Expected incorrect sorting (z then x then y):");
        const expectedIncorrect = [
          { _key: "1", value: [1152921504606846976, "z"] },
          { _key: "2", value: [1152921504606846977, "x"] },
          { _key: "3", value: [1.152921504606847e+18, "y"] }
        ];
        print("Expected result:", JSON.stringify(expectedIncorrect, null, 2));

        if (JSON.stringify(resultBeforeFix) !== JSON.stringify(expectedIncorrect)) {
          throw new Error("Sorting result does not match expected incorrect order!");
        }
      } else {
        // For versions >= 3.11.11 or >= 3.12.2, check the correct sorting order (y, z, x)
        print("Expected correct sorting (y then z then x):");
        const expectedCorrect = [
          { _key: "3", value: [1.152921504606847e+18, "y"] },
          { _key: "1", value: [1152921504606846976, "z"] },
          { _key: "2", value: [1152921504606846977, "x"] }
        ];
        print("Expected result:", JSON.stringify(expectedCorrect, null, 2));

        if (JSON.stringify(resultBeforeFix) !== JSON.stringify(expectedCorrect)) {
          throw new Error("Sorting result does not match expected correct order!");
        }
      }
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
