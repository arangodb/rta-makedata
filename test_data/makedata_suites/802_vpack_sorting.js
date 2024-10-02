/* global print, db, progress, createCollectionSafe, createIndexSafe, time, runAqlQueryResultCount, aql, resetRCount, writeData, semver */

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
      createIndexSafe({ col: c, type: "persistent", fields: ["value"] });
    },
    makeData: function (options, isCluster, isEnterprise, dbCount, loopCount) {
      print(`802: VPack Sorting making data ${dbCount} ${loopCount}`);
      let c = db[`vpack_sorting_c_${dbCount}`];

      // Insert test data with loopCount added as an attribute:
      progress('802: inserting test data');
      db._query(aql`
        INSERT { _key: "1", value: [1152921504606846976, "z"], loopCount: ${loopCount} } INTO ${c}
      `);
      db._query(aql`
        INSERT { _key: "2", value: [1152921504606846977, "x"], loopCount: ${loopCount} } INTO ${c}
      `);
      db._query(aql`
        INSERT { _key: "3", value: [1.152921504606847e+18, "y"], loopCount: ${loopCount} } INTO ${c}
      `);
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      print(`802: VPack Sorting checking per database data ${dbCount}`);
      let c = db._collection(`vpack_sorting_c_${dbCount}`);

      const currentVersionSemver = semver.parse(semver.coerce(options.curVersion));
      const oldVersionSemver = semver.parse(semver.coerce(options.oldVersion));
      const minVersion312Semver = semver.parse(semver.coerce("3.12.2"));
      const maxVersion311Semver = semver.parse(semver.coerce("3.11.11"));
      let isVersionUncapable = function (versionToCheck) {
        return (semver.lt(versionToCheck, maxVersion311Semver) ||
          (semver.gte(versionToCheck, semver.parse("3.12.0")) && semver.lt(versionToCheck, minVersion312Semver)));
      }
      let hasOldVersion = isVersionUncapable(currentVersionSemver) || isVersionUncapable(oldVersionSemver);

      // Print the version being tested
      progress(`Testing version: ${options.curVersion}`);
      // Check sorting before migration
      progress("802: checking sorting before migration");
      let actual = db._query(aql`FOR doc IN ${c} SORT doc.value RETURN { _key: doc._key, value: doc.value }`).toArray(); // Return only _key and value

      print("Actual sorting result:", JSON.stringify(actual, null, 2));
      if (hasOldVersion) {
        // For versions below 3.11.11 and versions in the range 3.12.0 to < 3.12.2, check the incorrect sorting order (z then x then y)
        const expectedIncorrect = [
          { _key: "1", value: [1152921504606846976, "z"] },
          { _key: "2", value: [1152921504606846977, "x"] },
          { _key: "3", value: [1.152921504606847e+18, "y"] }
        ];
        print("Expected incorrect sorting (z then x then y):", JSON.stringify(expectedIncorrect, null, 2));
        assertEqual(JSON.stringify(expectedIncorrect), JSON.stringify(actual), "Sorting result does not match expected incorrect order!")
      } else {
        // For versions 3.11.11 and newer and versions >= 3.12.2, check the correct sorting order (y then z then x)
        const expectedCorrect = [
          { _key: "3", value: [1.152921504606847e+18, "y"] },
          { _key: "1", value: [1152921504606846976, "z"] },
          { _key: "2", value: [1152921504606846977, "x"] }
        ];
        print("Expected correct sorting (y then z then x):", JSON.stringify(expectedCorrect, null, 2));
        assertEqual(JSON.stringify(expectedCorrect), JSON.stringify(actual), "Sorting result does not match expected correct order!");
        let ret;
        ret = db._query(aql`
        FOR doc in ${c} FILTER TO_STRING(doc.value[0]) == '1152921504606846976' return doc.value[1]
      `).toArray();
        assertEqual(ret.length, 1);
        assertEqual(ret[0], 'z');
        ret = db._query(aql`
        FOR doc in ${c} FILTER TO_STRING(doc.value[0]) == '1152921504606846977' return doc.value[1]
      `).toArray();
        assertEqual(ret.length, 1);
        assertEqual(ret[0], 'x');
        ret = db._query(aql`
        FOR doc in ${c} FILTER TO_STRING(doc.value[0]) == '1152921504606846976.0' return doc.value[1]
      `).toArray();
        assertEqual(ret.length, 1);
        assertEqual(ret[0], 'y');
      }
    },
    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`802: VPack Sorting clearing per database data ${dbCount}`);
      try {
        db._drop(`vpack_sorting_c_${dbCount}`);
      } catch (e) { }
    },
    clearData: function (options, isCluster, isEnterprise, dbCount, loopCount) {
      print(`802: VPack Sorting clearing data ${dbCount} ${loopCount}`);
      try {
        db._drop(`vpack_sorting_c_${loopCount}`);
      } catch (e) { }
    }
  };
}());
