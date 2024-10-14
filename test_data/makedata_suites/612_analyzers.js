/* global print, semver, progress, createSafe, createCollectionSafe, db, analyzers, fs, PWD, createAnalyzerSet, checkAnalyzerSet, deleteAnalyzerSet */
/*jslint maxlen: 100*/

function getTestData_612(dbCount) {
  return [
    {
      analyzerName: `multi_delimiter_${dbCount}`,
      bindVars: {
        analyzerName: `multi_delimiter_${dbCount}`
      },
      query: "RETURN TOKENS('some:delimited;words,with.multiple/delimitersÛunicode⚽asßwell⚽(◕‿◕)🪗🪗⚽Û✍', @analyzerName)",
      analyzerProperties: [
        "multi_delimiter",
        {
          delimiters: [
            ":",
            ";",
            ",",
            ".",
            "/",
            " ",
            "⚽",
            "ß",
            "Û"
          ]
        },
        [
          "frequency",
          "norm",
          "position"
        ]
      ],
      analyzerType: "multi_delimiter",
      properties: {
        "delimiters": [
          ":",
          ";",
          ",",
          ".",
          "/",
          " ",
          "⚽",
          "ß",
          "Û"
        ]
      },
      expectedResult: [
        [
          "some",
          "delimited",
          "words",
          "with",
          "multiple",
          "delimiters",
          "unicode",
          "as",
          "well",
          "(◕‿◕)🪗🪗",
          "✍"
        ]
      ]
    },
    {
      analyzerName: `wildcard_${dbCount}`,
      bindVars: {
        analyzerName: `wildcard_${dbCount}`
      },
      query: "RETURN TOKENS('ẬℬrẬc⏰adabra', @analyzerName)",
      analyzerProperties: [
        "wildcard",
        {
          ngramSize: 5
        },
        [
          "frequency",
          "norm",
          "position"
        ]
      ],
      analyzerType: "wildcard",
      properties: {
        "ngramSize": 5
      },
      expectedResult: [
        [
          "�ẬℬrẬ",
          "ẬℬrẬc",
          "ℬrẬc⏰",
          "rẬc⏰a",
          "Ậc⏰ad",
          "c⏰ada",
          "⏰adab",
          "adabr",
          "dabra",
          "abra�",
          "bra�",
          "ra�",
          "a�"
        ]
      ]
    }
  ];
}

(function () {
  const a = require("@arangodb/analyzers");
  return {
    isSupported: function (currentVersion, oldVersion, options, enterprise) {
      let currentVersionSemver = semver.parse(semver.coerce(currentVersion));
      let oldVersionSemver = semver.parse(semver.coerce(oldVersion));
      return semver.gte(currentVersionSemver, "3.12.0") && semver.gte(oldVersionSemver, "3.12.0");
    },

    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      // All items created must contain dbCount

      print(`612: making per database data ${dbCount}`);
      getTestData_612(dbCount).forEach((test) => {
        createAnalyzerSet('612', test);
      });
      return 0;
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      print(`612: checking data ${dbCount}`);
      progress(`612: checking data with ${dbCount}`);

      getTestData_612(dbCount).forEach(test => {
        checkAnalyzerSet('612', test);
      });
      return 0;
    },
    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`612: clearing data ${dbCount}`);
      getTestData_612(dbCount).forEach(test => {
        deleteAnalyzerSet('612', test);
      });
      return 0;
    }
  };

}());
