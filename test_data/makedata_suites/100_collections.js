/* global print,  db, progress, createCollectionSafe, createIndexSafe, time, assertCollectionCount, assertIndexType, assertIndexCount, runAqlQueryResultCount, aql,  resetRCount, writeData, getValue, semver, isInstrumented */

// This file uses hash and skiplist indexes which are deprecated in 4.0+
// makeData/makeDataFinalize run on 3.12 (version < 4.0) and create hash/skiplist indexes.
// checkData runs only on current version < 4.0 (not after upgrade). For post-upgrade on 4.0, 110_collections.js checkData verifies indexes were converted to persistent.

(function () {
  return {
    isSupported: function (version, oldVersion, options, enterprise, cluster) {
      let versionSemver = semver.parse(semver.coerce(version));
      return semver.lt(versionSemver, "4.0.0");
    },
    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      // All items created must contain dbCount and loopCount
      // Create a few collections:
      let c = createCollectionSafe(`c_${dbCount}`, 3, 2);
      progress('100: createCollection1');
      let chash = createCollectionSafe(`chash_${dbCount}`, 3, 2);
      progress('100: createCollection2');
      let cskip = createCollectionSafe(`cskip_${dbCount}`, 1, 1);
      progress('100: createCollection3');
      let cfull = createCollectionSafe(`cfull_${dbCount}`, 3, 1);
      progress('100: createCollection4');
      let cgeo = createCollectionSafe(`cgeo_${dbCount}`, 3, 2);
      progress('100: createCollectionGeo5');
      let cunique = createCollectionSafe(`cunique_${dbCount}`, 1, 1);
      progress('100: createCollection6');
      let cmulti = createCollectionSafe(`cmulti_${dbCount}`, 3, 2);
      progress('100: createCollection7');
      let cempty = createCollectionSafe(`cempty_${dbCount}`, 3, 1);

      // create a special collection, which will store only one document - current arangodb version
      // version is required for 402_views.js test case
      let version_coll = createCollectionSafe(`version_collection_${dbCount}`, 3, 2);
      version_coll.insert({"version": db._version()});

    },
    makeData: function (options, isCluster, isEnterprise, dbCount, loopCount) {
      progress(`100: Makedata ${dbCount} ${loopCount}`);
      let c = db[`c_${dbCount}`];
      let chash = db[`chash_${dbCount}`];
      let cskip = db[`cskip_${dbCount}`];
      let cfull = db[`cfull_${dbCount}`];
      let cgeo = db[`cgeo_${dbCount}`];
      let cunique = db[`cunique_${dbCount}`];
      let cmulti = db[`cmulti_${dbCount}`];
      let cempty = db[`cempty_${dbCount}`];

      // Now the actual data writing:
      resetRCount();
      writeData(c, getValue(1000));
      progress('100: writeData1');
      writeData(chash, getValue(12345));
      progress('100: writeData2');
      writeData(cskip, getValue(2176));
      progress('100: writeData3');
      writeData(cgeo, getValue(5245));
      progress('100: writeData4');
      writeData(cfull, getValue(6253));
      progress('100: writeData5');
      writeData(cunique, getValue(5362));
      progress('100: writeData6');
      writeData(cmulti, getValue(12346));
      progress('100: writeData7');
    },
    makeDataFinalize: function (options, isCluster, isEnterprise, dbCount) {
      progress(`100: Makedata ${dbCount} creating indices`);
      let c = db[`c_${dbCount}`];
      let chash = db[`chash_${dbCount}`];
      let cskip = db[`cskip_${dbCount}`];
      let cfull = db[`cfull_${dbCount}`];
      let cgeo = db[`cgeo_${dbCount}`];
      let cunique = db[`cunique_${dbCount}`];
      let cmulti = db[`cmulti_${dbCount}`];
      let cempty = db[`cempty_${dbCount}`];

      // Create some indexes:
      progress('100: createCollection8');
      createIndexSafe({col: chash, type: "hash", fields: ["a"], unique: false});
      progress('100: createIndexHash1');
      createIndexSafe({col: cskip, type: "skiplist", fields: ["a"], unique: false});
      progress('100: createIndexSkiplist2');
      createIndexSafe({col: cfull, type: "fulltext", fields: ["text"], minLength: 4});
      progress('100: createIndexFulltext3');
      createIndexSafe({col: cgeo, type: "geo", fields: ["position"], geoJson: true});
      progress('100: createIndexGeo4');
      createIndexSafe({col: cunique, type: "hash", fields: ["a"], unique: true});
      progress('100: createIndex5');
      createIndexSafe({col: cmulti, type: "hash", fields: ["a"], unique: false});
      progress('100: createIndex6');
      createIndexSafe({col: cmulti, type: "skiplist", fields: ["b", "c"]});
      progress('100: createIndex7');
      createIndexSafe({col: cmulti, type: "geo", fields: ["position"], geoJson: true});
      progress('100: createIndexGeo8');
      createIndexSafe({col: cmulti, type: "fulltext", fields: ["text"], minLength: 6});
      progress('100: createIndexFulltext9');
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      print(`${Date()} 100: checking data ${dbCount}`);
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
           print(`${Date()} 100: Didn't find this collection: ${colname}`);
           allFound = false;
         }
       });
      if (!allFound) {
        throw new Error("100: not all collections were present on the system!");
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

      // Check indexes:
      progress("100: checking indices");

      assertIndexCount(c, 1);
      assertIndexCount(chash, 2);
      assertIndexType(chash, 1, 'hash');
      assertIndexCount(cskip, 2);
      assertIndexType(cskip, 1, 'skiplist');
      assertIndexCount(cfull, 2);
      assertIndexType(cfull, 1, 'fulltext');
      assertIndexCount(cgeo, 2);
      assertIndexType(cgeo, 1, 'geo');
      assertIndexCount(cunique, 2);
      assertIndexCount(cmulti, 5);
      assertIndexCount(cempty, 1);

      if (cunique.getIndexes()[1].unique !== true) { throw new Error(`Mandarin ${cunique.getIndexes()[1].unique}`); }

      // Check data:
      progress("100: checking data");
      assertCollectionCount(c, getValue(1000) * options.dataMultiplier);
      assertCollectionCount(chash, getValue(12345) * options.dataMultiplier);
      assertCollectionCount(cskip, getValue(2176) * options.dataMultiplier);
      assertCollectionCount(cgeo, getValue(5245) * options.dataMultiplier);
      assertCollectionCount(cfull, getValue(6253) * options.dataMultiplier);
      assertCollectionCount(cunique, getValue(5362) * options.dataMultiplier);
      assertCollectionCount(cmulti, getValue(12346) * options.dataMultiplier);
      assertCollectionCount(cmulti, getValue(12346) * options.dataMultiplier);
      assertCollectionCount(version_collection, 1);

      // Check a few queries:
      progress("100: query 1");
      let searchID = isInstrumented? "id101":"id1001";
      runAqlQueryResultCount(aql`FOR x IN ${c} FILTER x.a == ${searchID} RETURN x`, 1);
      progress("100: query 2");
      searchID = isInstrumented? "id105":"id10452";
      runAqlQueryResultCount(aql`FOR x IN ${chash} FILTER x.a == ${searchID} RETURN x`, 1);
      if (options.dataMultiplier === 1) {
        progress("100: query 3");
        searchID = isInstrumented? "id1339":"id13948";
        runAqlQueryResultCount(aql`FOR x IN ${cskip} FILTER x.a == ${searchID} RETURN x`,  1);
      }
      progress("100: query 4");
      runAqlQueryResultCount(aql`FOR x IN ${cempty} RETURN x`, 0);
      if (options.dataMultiplier === 1) {
        progress("100: query 5");
        searchID = isInstrumented? "id1556":"id20473";
        runAqlQueryResultCount(aql`FOR x IN ${cgeo} FILTER x.a == ${searchID} RETURN x`, 1);
        progress("100: query 6");
        searchID = isInstrumented? "id2709":"id32236";
        runAqlQueryResultCount(aql`FOR x IN ${cunique} FILTER x.a == ${searchID} RETURN x`, 1);
        progress("100: query 6");
        searchID = isInstrumented? "id3245":"id32847";
        runAqlQueryResultCount(aql`FOR x IN ${cmulti} FILTER x.a == ${searchID} RETURN x`, 1);
      }
      progress("100: queries done");
      progress("100: done");
    },
    clearData: function (options, isCluster, isEnterprise, dbCount, loopCount, readOnly) {
      print(`${Date()} 100: clearing data ${dbCount} ${loopCount}`);
      progress("100: drop 1");
      try {
        db._drop(`c_${loopCount}`);
      } catch (e) {}
      progress("100: drop 2");
      try {
        db._drop(`chash_${loopCount}`);
      } catch (e) {}
      progress("100: drop 3");
      try {
        db._drop(`cskip_${loopCount}`);
      } catch (e) {}
      progress("100: drop 4");
      try {
        db._drop(`cfull_${loopCount}`);
      } catch (e) {}
      progress("100: drop 5");
      try {
        db._drop(`cgeo_${loopCount}`);
      } catch (e) {}
      progress("100: drop 6");
      try {
        db._drop(`cunique_${loopCount}`);
      } catch (e) {}
      progress("100: drop 7");
      try {
        db._drop(`cmulti_${loopCount}`);
      } catch (e) {}
      progress("100: drop 8");
      try {
        db._drop(`cempty_${loopCount}`);
      } catch (e) {}
      progress("100: drop 9");
      try {
        db._drop(`version_collection_${loopCount}`);
      } catch (e) {}
      progress("100: drop done");
    }
  };
}());
