/* global print,  db, progress, createCollectionSafe, createIndexSafe, time, runAqlQueryResultCount, aql,  resetRCount, writeData, semver */

// This file uses hash and skiplist indexes which are deprecated in 4.0+
// For 4.0+, use 110_collections.js instead which uses persistent indexes

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
      writeData(c, 1000);
      progress('100: writeData1');
      writeData(chash, 12345);
      progress('100: writeData2');
      writeData(cskip, 2176);
      progress('100: writeData3');
      writeData(cgeo, 5245);
      progress('100: writeData4');
      writeData(cfull, 6253);
      progress('100: writeData5');
      writeData(cunique, 5362);
      progress('100: writeData6');
      writeData(cmulti, 12346);
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

      if (c.getIndexes().length !== 1) { throw new Error(`Banana ${c.getIndexes().length}`); }
      if (chash.getIndexes().length !== 2) { throw new Error(`Apple ${chash.getIndexes().length}`); }
      if (chash.getIndexes()[1].type !== 'hash') { throw new Error(`Pear ${chash.getIndexes()[1].type}`); }
      if (cskip.getIndexes().length !== 2) { throw new Error(`Tomato ${cskip.getIndexes().length}`); }
      if (cskip.getIndexes()[1].type !== 'skiplist') { throw new Error(`Avocado ${cskip.getIndexes()[1].type}`); }
      if (cfull.getIndexes().length !== 2) { throw new Error(`Mango ${cfull.getIndexes().length}`); }
      if (cfull.getIndexes()[1].type !== 'fulltext') { throw new Error(`Cucumber ${cfull.getIndexes()[1].type}`); }
      if (cgeo.getIndexes().length !== 2) { throw new Error(`Jackfruit ${cgeo.getIndexes().length}`); }
      if (cgeo.getIndexes()[1].type !== 'geo') { throw new Error(`Onion ${cgeo.getIndexes()[1].type}`); }
      if (cunique.getIndexes().length !== 2) { throw new Error(`Durian ${cunique.getIndexes().length}`); }
      if (cunique.getIndexes()[1].unique !== true) { throw new Error(`Mandarin ${cunique.getIndexes()[1].unique}`); }
      if (cmulti.getIndexes().length !== 5) { throw new Error(`Leek ${cmulti.getIndexes().length}`); }
      if (cempty.getIndexes().length !== 1) { throw new Error(`Pineapple ${cempty.getIndexes().length}`); }

      // Check data:
      progress("100: checking data");
      if (c.count() !== 1000 * options.dataMultiplier) { throw new Error(`Audi ${c.count()} !== 1000`); }
      if (chash.count() !== 12345 * options.dataMultiplier) { throw new Error(`VW ${chash.count()} !== 12345`); }
      if (cskip.count() !== 2176 * options.dataMultiplier) { throw new Error(`Tesla ${cskip.count()} !== 2176`); }
      if (cgeo.count() !== 5245 * options.dataMultiplier) { throw new Error(`Mercedes ${cgeo.count()} !== 5245`); }
      if (cfull.count() !== 6253 * options.dataMultiplier) { throw new Error(`Renault ${cfull.count()} !== 6253`); }
      if (cunique.count() !== 5362 * options.dataMultiplier) { throw new Error(`Opel ${cunique.count()} !== 5362`); }
      if (cmulti.count() !== 12346 * options.dataMultiplier) { throw new Error(`Fiat ${cmulti.count()} !== 12346`); }
      if (cmulti.count() !== 12346 * options.dataMultiplier) { throw new Error(`Fiat ${cmulti.count()} !== 12346`); }
      if (version_collection.count() !== 1) { throw new Error(`Fiat ${version_collection.count()} !== 1`); }

      // Check a few queries:
      progress("100: query 1");
      runAqlQueryResultCount(aql`FOR x IN ${c} FILTER x.a == "id1001" RETURN x`, 1);
      progress("100: query 2");
      runAqlQueryResultCount(aql`FOR x IN ${chash} FILTER x.a == "id10452" RETURN x`, 1);
      if (options.dataMultiplier === 1) {
        progress("100: query 3");
        runAqlQueryResultCount(aql`FOR x IN ${cskip} FILTER x.a == "id13948" RETURN x`,  1);
      }
      progress("100: query 4");
      runAqlQueryResultCount(aql`FOR x IN ${cempty} RETURN x`, 0);
      if (options.dataMultiplier === 1) {
        progress("100: query 5");
        runAqlQueryResultCount(aql`FOR x IN ${cgeo} FILTER x.a == "id20473" RETURN x`, 1);
        progress("100: query 6");
        runAqlQueryResultCount(aql`FOR x IN ${cunique} FILTER x.a == "id32236" RETURN x`, 1);
        progress("100: query 6");
        runAqlQueryResultCount(aql`FOR x IN ${cmulti} FILTER x.a == "id32847" RETURN x`, 1);
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
