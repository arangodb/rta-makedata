/* global print, progress, createCollectionSafe, db, createSafe, assertEqual, semver, _ */

(function () {

    let scorers = [
      'BM25(@doc) DESC',
      'BM25(@doc, 1.2) DESC',
      'BM25(@doc, 1.2, 0.75) DESC',
      'BM25(@doc, 1.20000, 0.7500000) DESC',
      'TFIDF(@doc, true) DESC', 
      'TFIDF(@doc, false) DESC'
    ];

    let launchQueries = function(viewName) {

      // check query without sorting by score
      let r1 = db._query(`FOR d IN ${viewName} SEARCH d.a == 'a' OPTIONS {waitForSync:true} LIMIT 10 RETURN d`).toArray();
      assertEqual(r1.length, 10);
      let r2 = db._query(`FOR d IN ${viewName} SEARCH d.b == 'b' OPTIONS {waitForSync:true} LIMIT 10 RETURN d`).toArray();
      assertEqual(r2.length, 10);
      
      let extended_scorers = scorers;
      extended_scorers.push('BM25(@doc, 1.3, 1) DESC');
      extended_scorers.push('BM25(@doc, 1, 1) DESC');

      for (const s of extended_scorers) {
        print(`404: ${s}`);
        let score = s.replace('@doc', 'd');
        let res1 = db._query(`FOR d IN ${viewName} SEARCH d.a == 'a' OPTIONS {waitForSync:true} SORT ${score} LIMIT 10 RETURN d`).toArray();
        assertEqual(res1.length, 10);
        let res2 = db._query(`FOR d IN ${viewName} SEARCH d.b == 'b' OPTIONS {waitForSync:true} SORT ${score} LIMIT 10 RETURN d`).toArray();
        assertEqual(res2.length, 10);
      }
    };

    return {
      isSupported: function (version, oldVersion, enterprise, cluster) {
        let currentVersionSemver = semver.parse(semver.coerce(version));
        let oldVersionSemver = semver.parse(semver.coerce(oldVersion));
        return semver.gte(currentVersionSemver, "3.12.0") && semver.gte(oldVersionSemver, "3.12.0");
      },
      makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
        // All items created must contain dbCount and dbCount
        print(`404: making data ${dbCount}`);
        let asViewWandName = `as_view_wand_${dbCount}`;
        let saViewWandName = `sa_view_wand_${dbCount}`;
        let collectionName0 = `collection_wand_0${dbCount}`;
        let collectionName1 = `collection_wand_1${dbCount}`;

        let c0 = createCollectionSafe(collectionName0, 3, 2, {"writeConcern": 1})
        let c1 = createCollectionSafe(collectionName1, 3, 2, {"writeConcern": 1})

        let meta0 = {
          'links': { },
          'optimizeTopK': scorers
        };
        meta0["links"][collectionName0] = {
          'fields': {
            'a': {}
          }
        };
        let as_view = db._createView(asViewWandName, "arangosearch", meta0);

        c0.ensureIndex({"type": "inverted", "name": "inverted", "fields": ["a"], "optimizeTopK": scorers});

        let docs = [];
        for (let i = 0; i < 1000; ++i) {
          docs.push({a: "a", b: "b"});
        }
        c0.save(docs);
        c1.save(docs);

        c1.ensureIndex({"type": "inverted", "name": "inverted", "fields": ["b"], "optimizeTopK": scorers});

        let meta1 = {
          "links": {}
        };
        meta1["links"][collectionName1] = {
          'fields': {
            'b': {}
          }
        };
        as_view.properties(meta1, true);

        let sa_view = db._createView(saViewWandName, 'search-alias', {
          'indexes': [
            {'collection': collectionName0.valueOf(), 'index': 'inverted'},
            {'collection': collectionName1.valueOf(), 'index': 'inverted'}
          ]
        });

        for (const v of [asViewWandName, saViewWandName]) {
          launchQueries(v);
        }
      },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
        print(`404: checking data ${dbCount} ${dbCount}`);
        let asViewWandName = `as_view_wand_${dbCount}`;
        let saViewWandName = `sa_view_wand_${dbCount}`;
        let collectionName0 = `collection_wand_0${dbCount}`;
        let collectionName1 = `collection_wand_1${dbCount}`;

        let asView = db._view(asViewWandName);
        let c0 = db._collection(collectionName0);
        let c1 = db._collection(collectionName1);

        let actual_view = asView.properties()["optimizeTopK"];
        let actual_i0 = c0.index("inverted")["optimizeTopK"];
        let actual_i1 = c1.index("inverted")["optimizeTopK"];

        if (isEnterprise) {
          if (!_.isEqual(actual_view, scorers)) {
            throw new Error(`${asViewWandName}: 'optimizeTopK' array is not correct.
            Actual: ${actual_view},
            Expected: ${scorers}`);
          }
  
          if (!_.isEqual(actual_i0, scorers)) {
            throw new Error(`${collectionName0}: 'optimizeTopK' array is not correct.
            Actual: ${actual_i0},
            Expected: ${scorers}`);
          }
  
          if (!_.isEqual(actual_i1, scorers)) {
            throw new Error(`${collectionName1}: 'optimizeTopK' array is not correct.
            Actual: ${actual_i1},
            Expected: ${scorers}`);
          }
        } else {
          if (!_.isEqual(actual_view, undefined)) {
            throw new Error(`${asViewWandName}: 'optimizeTopK' array is not empty.
            Actual: ${actual_view},
            Expected: ${undefined}`);
          }
  
          if (!_.isEqual(actual_i0, undefined)) {
            throw new Error(`${collectionName0}: 'optimizeTopK' array is not empty.
            Actual: ${actual_i0},
            Expected: ${undefined}`);
          }
  
          if (!_.isEqual(actual_i1, undefined)) {
            throw new Error(`${collectionName1}: 'optimizeTopK' array is not empty.
            Actual: ${actual_i1},
            Expected: ${undefined}`);
          }
        }

        for (const v of [asViewWandName, saViewWandName]) {
          launchQueries(v);
        }
      },
    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
        print(`404: removing data ${dbCount}`);
        let asViewWandName = `as_view_wand_${dbCount}`;
        let saViewWandName = `sa_view_wand_${dbCount}`;
        let collectionName0 = `collection_wand_0${dbCount}`;
        let collectionName1 = `collection_wand_1${dbCount}`;

        db._dropView(asViewWandName);
        db._dropView(saViewWandName);
        db._drop(collectionName0);
        db._drop(collectionName1);
      }
    };
  }());
  
