/* global print, progress, createCollectionSafe, db, createSafe  */

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
      let r = db._query(`FOR d IN ${viewName} SEARCH d.a == 'a' OPTIONS {waitForSync:true} LIMIT 10 RETURN d`).toArray();
      assertEqual(r.length, 10);

      for (const s of scorers) {
        let score = s.replace('@doc', 'd');
        let res = db._query(`FOR d IN ${viewName} SEARCH d.a == 'a' OPTIONS {waitForSync:true} SORT ${score} LIMIT 10 RETURN d`).toArray();
        assertEqual(res.length, 10);
      }
    };

    return {
      isSupported: function (version, oldVersion, enterprise, cluster) {
        return semver.gte(version, '3.10.15');
      },
      makeData: function (options, isCluster, isEnterprise, dbCount, loopCount) {
        // All items created must contain dbCount and loopCount
        print(`making data ${dbCount} ${loopCount}`);
        let asViewWandName = `as_view_wand_${loopCount}`;
        let saViewWandName = `sa_view_wand_${loopCount}`;
        let collectionName0 = `collection_wand_0${loopCount}`;
        let collectionName1 = `collection_wand_1${loopCount}`;


        let c0 = db._create(collectionName0, {"numberOfShards": 3, "replicationFactor": 3, "writeConcern": 3});
        let c1 = db._create(collectionName1, {"numberOfShards": 3, "replicationFactor": 3, "writeConcern": 3});

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

        c1.ensureIndex({"type": "inverted", "name": "inverted", "fields": ["a"], "optimizeTopK": scorers});

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
      checkData: function (options, isCluster, isEnterprise, dbCount, loopCount, readOnly) {
        print(`checking data ${dbCount} ${loopCount}`);
        let asViewWandName = `as_view_wand_${loopCount}`;
        let saViewWandName = `sa_view_wand_${loopCount}`;
        let collectionName0 = `collection_wand_0${loopCount}`;
        let collectionName1 = `collection_wand_1${loopCount}`;

        let asView = db._view(asViewWandName);
        let c0 = db._collection(collectionName0);
        let c1 = db._collection(collectionName1);

        let actual = asView.properties()["optimizeTopK"];
        if (!_.isEqual(actual, scorers)) {
          throw new Error(`${asViewWandName}: 'optimizeTopK' array is not correct.
          Actual: ${asView.properties()["optimizeTopK"]},
          Expected: ${scorers}`);
        }

        actual = c0.index("inverted")["optimizeTopK"];
        if (!_.isEqual(actual, scorers)) {
          throw new Error(`${collectionName0}: 'optimizeTopK' array is not correct.
          Actual: ${c0.index("inverted")["optimizeTopK"]},
          Expected: ${scorers}`);
        }

        actual = c1.index("inverted")["optimizeTopK"];
        if (!_.isEqual(actual, scorers)) {
          throw new Error(`${collectionName1}: 'optimizeTopK' array is not correct.
          Actual: ${c1.index("inverted")["optimizeTopK"]},
          Expected: ${scorers}`);
        }

        for (const v of [asViewWandName, saViewWandName]) {
          launchQueries(v);
        }
      },
      clearData: function (options, isCluster, isEnterprise, dbCount, loopCount, readOnly) {
        print(`removing data ${dbCount} ${loopCount}`);
        let asViewWandName = `as_view_wand_${loopCount}`;
        let saViewWandName = `sa_view_wand_${loopCount}`;
        let collectionName0 = `collection_wand_0${loopCount}`;
        let collectionName1 = `collection_wand_1${loopCount}`;

        db._dropView(asViewWandName);
        db._dropView(saViewWandName);
        db._drop(collectionName0);
        db._drop(collectionName1);
      }
    };
  }());
  