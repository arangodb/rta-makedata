/* global print, db, progress, createCollectionSafe, createIndexSafe, time, runAqlQueryResultCount, aql, resetRCount, writeData */

(function () {
  return {
    isSupported: function (version, oldVersion, options, enterprise, cluster) {
      return true; // Assuming ICU is supported in all environments
    },
    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      // All items created must contain dbCount
      print(`${Date()} 800: ICU: making per database data ${dbCount}`);
      let test = createCollectionSafe(`icu_test_${dbCount}`, 3, 2);
      progress('800: createICUCollection1');

      // Inserting test data:
      test.insert({ value: "\u2013", value2: 1 });
      test.insert({ value: "\u2014", value2: 2 });
      test.insert({ value: "\u2026", value2: 3 });
      test.insert({ value: "\u0027", value2: 4 });
      test.insert({ value: "\u0027a", value2: 5 });
      test.insert({ value: "\u2018", value2: 6 });
      test.insert({ value: "\u2019", value2: 7 });
      test.insert({ value: "\u2019a", value2: 8 });
      test.insert({ value: "\u201C", value2: 9 });
      test.insert({ value: "\u201D", value2: 10 });
      test.insert({ value: "\u2022", value2: 11 });
      test.insert({ value: "\u00A9", value2: 12 });
      test.insert({ value: "\u00AE", value2: 13 });

      // Create persistent index:
      progress('800: createICUIndex1');
      createIndexSafe({ col: test, type: "persistent", fields: ["value", "value2"] });
    },
    makeData: function (options, isCluster, isEnterprise, dbCount, loopCount) {
      // All items created must contain dbCount and loopCount
      print(`${Date()} 800: ICU: making data ${dbCount} ${loopCount}`);
      let test = db[`icu_test_${dbCount}`];

      // Now the actual data writing (not needed in this test setup):
      resetRCount();
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      print(`${Date()} 800: ICU: checking per database data ${dbCount}`);
      let cols = db._collections();
      let allFound = true;
      [`icu_test_${dbCount}`].forEach(colname => {
        let foundOne = false;
        cols.forEach(oneCol => {
          if (oneCol.name() === colname) {
            foundOne = true;
          }
        });
        if (!foundOne) {
          print(`${Date()} 800: Didn't find this collection: ${colname}`);
          allFound = false;
        }
      });
      if (!allFound) {
        throw new Error("800: not all ICU collections were present on the system!");
      }

      let test = db._collection(`icu_test_${dbCount}`);

      // Check persistent index:
      progress("800: checking ICU indices");
      let persistentIndexFound = false;
      test.getIndexes().forEach(idx => {
        if (idx.type === 'persistent') {
          persistentIndexFound = true;
        }
      });
      if (!persistentIndexFound) {
        throw new Error(`800: Expected at least one persistent index in ICU test collection`);
      }

      // Check data and sorting order:
      progress(`${Date()} 800: checking ICU data and sort order`);
      let queryResult = db._query(`FOR doc in ${test.name()} SORT doc.value, doc.value2 RETURN [doc.value, doc.value2]`).toArray();
      let expectedOrder = [
        ["–", 1],
        ["—", 2],
        ["…", 3],
        ["'", 4],
        ["'a", 5],
        ["‘", 6],
        ["’", 7],
        ["’a", 8],
        ["“", 9],
        ["”", 10],
        ["•", 11],
        ["©", 12],
        ["®", 13]
      ];

      for (let i = 0; i < expectedOrder.length; i++) {
        if (queryResult[i][0] !== expectedOrder[i][0] || queryResult[i][1] !== expectedOrder[i][1]) {
          throw new Error(`800: ICU Sort order mismatch. Expected [${expectedOrder[i]}], but got [${queryResult[i]}]`);
        }
      }
      progress("800: ICU check done");
    },
    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} ICU: clearing per database data ${dbCount}`);
      try {
        db._drop(`icu_test_${dbCount}`);
      } catch (e) {}
    },
  };
}());
