/* global print, db, aql, progress, createCollectionSafe, time, runAqlQueryResultCount, resetRCount */

(function () {
    return {
      isSupported: function (version, oldVersion, options, enterprise, cluster) {
        return true; // Assuming UDF is supported in all environments
      },
  
      makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
        print(`${Date()} 801: UDF: making per database data ${dbCount}`);
        let c = createCollectionSafe(`udf_test_${dbCount}`, 3, 2);
        progress('801: createUDFCollection');
      },
  
      makeData: function (options, isCluster, isEnterprise, dbCount, loopCount) {
        print(`${Date()} 801: UDF: making data ${dbCount} ${loopCount}`);
        var aqlfunctions = require("@arangodb/aql/functions");
  
        // Define and register the UDF
        function sortUnicodeCharacters(characters) {
          return characters.sort();
        }
        aqlfunctions.register("MYFUNCTIONS::SORT_UNICODE", sortUnicodeCharacters, true);
  
        var unicodeCharacters = [
          "\u2013",
          "\u2014",
          "\u2026",
          "\u0027",
          "\u0027a",
          "\u2018",
          "\u2019",
          "\u2019a",
          "\u201C",
          "\u201D",
          "\u2022",
          "\u00A9",
          "\u00AE",
          "\u00B0",
          "\u00B1",
          "\u00B2",
          "\u00B3",
          "\u00B6",
          "\u00B7",
          "\u00B9",
          "\u00BC",
          "\u00BD",
          "\u00BE",
          "\u00D7",
          "\u00F7",
          "\u2030",
          "\u2031",
          "\u2032",
          "\u2033",
          "\u2034",
          "\u2035",
          "\u2036",
          "\u2037"
        ];
  
        var sortedCharacters = db._query(aql`RETURN MYFUNCTIONS::SORT_UNICODE(${unicodeCharacters})`).toArray();
        print(`${Date()} 801: sorted characters: ${sortedCharacters}`);
  
        // Store the sorted characters for verification later
        let c = db[`udf_test_${dbCount}`];
        resetRCount();
        sortedCharacters[0].forEach((character, index) => {
          c.insert({ value: character, order: index + 1 });
        });
        progress('801: inserted sorted characters');
      },
  
      checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
        print(`${Date()} 801: UDF: checking per database data ${dbCount}`);
        let c = db._collection(`udf_test_${dbCount}`);
        let allFound = true;
  
        if (!c) {
          throw new Error(`801: UDF test collection udf_test_${dbCount} not found`);
        }
  
        // Check if the UDF works as expected
        let expectedSorted = [
          "'",
          "'a",
          "©",
          "®",
          "°",
          "±",
          "²",
          "³",
          "¶",
          "·",
          "¹",
          "¼",
          "½",
          "¾",
          "×",
          "÷",
          "–",
          "—",
          "‘",
          "’",
          "’a",
          "“",
          "”",
          "•",
          "…",
          "‰",
          "‱",
          "′",
          "″",
          "‴",
          "‵",
          "‶",
          "‷"
        ];
  
        try {
          var sortedCharacters = db._query(aql`RETURN MYFUNCTIONS::SORT_UNICODE(${expectedSorted})`).toArray();
        } catch (e) {
          throw new Error("801: UDF MYFUNCTIONS::SORT_UNICODE is not registered or failed");
        }
  
        if (JSON.stringify(expectedSorted) !== JSON.stringify(sortedCharacters[0])) {
          throw new Error(`801: Sorted characters do not match expected order`);
        }
        progress('801: UDF data and sort order verified');
      },
  
      clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
        print(`${Date()} UDF: clearing per database data ${dbCount}`);
        try {
          db._drop(`udf_test_${dbCount}`);
        } catch (e) {}
      },
    };
  }());
  
