/* global print, db, progress, createCollectionSafe, createIndexSafe, assertCollectionCount, assertIndexType, assertIndexCount, time, runAqlQueryResultCount, aql, resetRCount, writeData, getValue, semver, isInstrumented */

// This is the ArangoDB 4.0+ version of 100_collections.js
// In 4.0, hash and skiplist indexes are converted to persistent.
// makeData runs only on 4.0+ (not on 3.12). checkData runs after upgrade on 4.0 and verifies that indexes created by 100 (hash/skiplist) are now persistent.

(function () {
  return {
    isSupported: function (version, oldVersion, options, enterprise, cluster) {
      let versionSemver = semver.parse(semver.coerce(version));
      return semver.gte(versionSemver, "4.0.0");
    },
    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      // All items created must contain dbCount and loopCount
      // Create collections:
      let c = createCollectionSafe(`c_${dbCount}`, 3, 2);
      progress('110: createCollection1');
      let cpersistent = createCollectionSafe(`cpersistent_${dbCount}`, 3, 2);
      progress('110: createCollection2');
      let cfull = createCollectionSafe(`cfull_${dbCount}`, 3, 1);
      progress('110: createCollection3');
      let cgeo = createCollectionSafe(`cgeo_${dbCount}`, 3, 2);
      progress('110: createCollectionGeo4');
      let cunique = createCollectionSafe(`cunique_${dbCount}`, 1, 1);
      progress('110: createCollection5');
      let cmulti = createCollectionSafe(`cmulti_${dbCount}`, 3, 2);
      progress('110: createCollection6');
      let cempty = createCollectionSafe(`cempty_${dbCount}`, 3, 1);

      // create a special collection, which will store only one document - current arangodb version
      // version is required for 402_views.js test case
      let version_coll = createCollectionSafe(`version_collection_${dbCount}`, 3, 2);
      version_coll.insert({"version": db._version()});

      // Create indexes:
      progress('110: createCollection7');
      createIndexSafe({col: cpersistent, type: "persistent", fields: ["a"], unique: false});
      progress('110: createIndexPersistent1');
      createIndexSafe({col: cgeo, type: "geo", fields: ["position"], geoJson: true});
      progress('110: createIndexGeo3');
      createIndexSafe({col: cunique, type: "persistent", fields: ["a"], unique: true});
      progress('110: createIndex4');
      createIndexSafe({col: cmulti, type: "persistent", fields: ["a"], unique: false});
      progress('110: createIndex5');
      createIndexSafe({col: cmulti, type: "persistent", fields: ["b", "c"]});
      progress('110: createIndex6');
      createIndexSafe({col: cmulti, type: "geo", fields: ["position"], geoJson: true});
      progress('110: createIndexGeo7');
    },
    makeData: function (options, isCluster, isEnterprise, dbCount, loopCount) {
      progress(`110: Makedata ${dbCount} ${loopCount}`);
      let c = db[`c_${dbCount}`];
      let cpersistent = db[`cpersistent_${dbCount}`];
      let cfull = db[`cfull_${dbCount}`];
      let cgeo = db[`cgeo_${dbCount}`];
      let cunique = db[`cunique_${dbCount}`];
      let cmulti = db[`cmulti_${dbCount}`];
      let cempty = db[`cempty_${dbCount}`];

      // Now the actual data writing:
      resetRCount();
      writeData(c, 1000);
      progress('110: writeData1');
      writeData(cpersistent, 12345);
      progress('110: writeData2');
      writeData(cgeo, 5245);
      progress('110: writeData3');
      writeData(cfull, 6253);
      progress('110: writeData4');
      writeData(cunique, 5362);
      progress('110: writeData5');
      writeData(cmulti, 12346);
      progress('110: writeData6');
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      // Post-upgrade check: data was created by 100 on 3.12 (chash_, cskip_, etc.). Verify indexes are now persistent.
      print(`${Date()} 110: checking data ${dbCount}`);
      let cols = db._collections();
      let allFound = true;
      [`c_${dbCount}`,
       `chash_${dbCount}`,
       `cskip_${dbCount}`,
       `cfull_${dbCount}`,
       `cgeo_${dbCount}`,
       `cunique_${dbCount}`,
       `cmulti_${dbCount}`,
       `cempty_${dbCount}`,
       `version_collection_${dbCount}`].forEach(colname => {
         let foundOne = false;
         cols.forEach(oneCol => {
           if (oneCol.name() === colname) {
             foundOne = true;
           }
         });
         if (!foundOne) {
           print(`${Date()} 110: Didn't find this collection: ${colname}`);
           allFound = false;
         }
       });
      if (!allFound) {
        throw new Error("110: not all collections were present on the system!");
      }

      let c = db._collection(`c_${dbCount}`);
      let chash = db._collection(`chash_${dbCount}`);
      let cskip = db._collection(`cskip_${dbCount}`);
      let cfull = db._collection(`cfull_${dbCount}`);
      let cgeo = db._collection(`cgeo_${dbCount}`);
      let cunique = db._collection(`cunique_${dbCount}`);
      let cmulti = db._collection(`cmulti_${dbCount}`);
      let cempty = db._collection(`cempty_${dbCount}`);
      let version_collection = db._collection(`version_collection_${dbCount}`);

      // Check indexes (hash/skiplist from 100 are now persistent in 4.0):
      progress("110: checking indices");

      assertIndexCount(c, 1);
      assertIndexCount(chash, 2);
      assertIndexType(chash, 1, 'persistent');
      assertIndexCount(cskip, 2);
      assertIndexType(cskip, 1, 'persistent');
      assertIndexCount(cfull, 2);
      assertIndexType(cfull, 1, 'fulltext');
      assertIndexCount(cgeo, 2);
      assertIndexType(cgeo, 1, 'geo');
      assertIndexCount(cunique, 2);
      assertIndexType(cunique, 1, 'persistent');
      assertIndexCount(cmulti, 5);
      assertIndexType(cmulti, 1, 'persistent');
      assertIndexType(cmulti, 2, 'persistent');
      assertIndexCount(cempty, 1);

      if (cunique.getIndexes()[1].unique !== true) { throw new Error(`Mandarin ${cunique.getIndexes()[1].unique}`); }

      // Check data:
      progress("110: checking data");
      assertCollectionCount(c, getValue(1000) * options.dataMultiplier);
      assertCollectionCount(chash, getValue(12345) * options.dataMultiplier);
      assertCollectionCount(cskip, getValue(2176) * options.dataMultiplier);
      assertCollectionCount(cgeo, getValue(5245) * options.dataMultiplier);
      assertCollectionCount(cfull, getValue(6253) * options.dataMultiplier);
      assertCollectionCount(cunique, getValue(5362) * options.dataMultiplier);
      assertCollectionCount(cmulti, getValue(12346) * options.dataMultiplier);
      assertCollectionCount(version_collection, 1);

      // Check a few queries:
      progress("110: query 1");
      let searchID = isInstrumented ? "id101" : "id1001";
      runAqlQueryResultCount(aql`FOR x IN ${c} FILTER x.a == ${searchID} RETURN x`, 1);
      progress("110: query 2");
      searchID = isInstrumented ? "id105" : "id10452";
      runAqlQueryResultCount(aql`FOR x IN ${chash} FILTER x.a == ${searchID} RETURN x`, 1);
      if (options.dataMultiplier === 1) {
        progress("110: query 3");
        searchID = isInstrumented ? "id1339" : "id13948";
        runAqlQueryResultCount(aql`FOR x IN ${cskip} FILTER x.a == ${searchID} RETURN x`, 1);
      }
      progress("110: query 4");
      runAqlQueryResultCount(aql`FOR x IN ${cempty} RETURN x`, 0);
      if (options.dataMultiplier === 1) {
        progress("110: query 5");
        searchID = isInstrumented ? "id1556" : "id20473";
        runAqlQueryResultCount(aql`FOR x IN ${cgeo} FILTER x.a == ${searchID} RETURN x`, 1);
        progress("110: query 6");
        searchID = isInstrumented ? "id2709" : "id32236";
        runAqlQueryResultCount(aql`FOR x IN ${cunique} FILTER x.a == ${searchID} RETURN x`, 1);
        progress("110: query 7");
        searchID = isInstrumented ? "id3245" : "id32847";
        runAqlQueryResultCount(aql`FOR x IN ${cmulti} FILTER x.a == ${searchID} RETURN x`, 1);
      }
      progress("110: queries done");
      progress("110: done");
    },
    clearData: function (options, isCluster, isEnterprise, dbCount, loopCount, readOnly) {
      // Drops same collections as 100 (post-upgrade cleanup):
      print(`${Date()} 110: clearing data ${dbCount} ${loopCount}`);
      progress("110: drop 1");
      try {
        db._drop(`c_${loopCount}`);
      } catch (e) {}
      progress("110: drop 2");
      try {
        db._drop(`chash_${loopCount}`);
      } catch (e) {}
      progress("110: drop 3");
      try {
        db._drop(`cskip_${loopCount}`);
      } catch (e) {}
      progress("110: drop 4");
      try {
        db._drop(`cfull_${loopCount}`);
      } catch (e) {}
      progress("110: drop 5");
      try {
        db._drop(`cgeo_${loopCount}`);
      } catch (e) {}
      progress("110: drop 6");
      try {
        db._drop(`cunique_${loopCount}`);
      } catch (e) {}
      progress("110: drop 7");
      try {
        db._drop(`cmulti_${loopCount}`);
      } catch (e) {}
      progress("110: drop 8");
      try {
        db._drop(`cempty_${loopCount}`);
      } catch (e) {}
      progress("110: drop 9");
      try {
        db._drop(`version_collection_${loopCount}`);
      } catch (e) {}
      progress("110: drop done");
    }
  };
}());
