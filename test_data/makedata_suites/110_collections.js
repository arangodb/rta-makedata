/* global print, db, progress, createCollectionSafe, createIndexSafe, time, runAqlQueryResultCount, aql, resetRCount, writeData, semver */

// This is the ArangoDB 4.0+ version of 100_collections.js
// In 4.0, hash and skiplist indexes are deprecated and replaced by persistent

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
      createIndexSafe({col: cfull, type: "fulltext", fields: ["text"], minLength: 4});
      progress('110: createIndexFulltext2');
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
      createIndexSafe({col: cmulti, type: "fulltext", fields: ["text"], minLength: 6});
      progress('110: createIndexFulltext8');
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
      print(`${Date()} 110: checking data ${dbCount}`);
      let cols = db._collections();
      let allFound = true;
      [`c_${dbCount}`,
       `cpersistent_${dbCount}`,
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
      let cpersistent = db._collection(`cpersistent_${dbCount}`);
      let cfull = db._collection(`cfull_${dbCount}`);
      let cgeo = db._collection(`cgeo_${dbCount}`);
      let cunique = db._collection(`cunique_${dbCount}`);
      let cmulti = db._collection(`cmulti_${dbCount}`);
      let cempty = db._collection(`cempty_${dbCount}`);
      let version_collection = db._collection(`version_collection_${dbCount}`);

      // Check indexes:
      progress("110: checking indices");

      if (c.getIndexes().length !== 1) { throw new Error(`Banana ${c.getIndexes().length}`); }
      if (cpersistent.getIndexes().length !== 2) { throw new Error(`Apple ${cpersistent.getIndexes().length}`); }
      if (cpersistent.getIndexes()[1].type !== 'persistent') { throw new Error(`Pear ${cpersistent.getIndexes()[1].type}`); }
      if (cfull.getIndexes().length !== 2) { throw new Error(`Mango ${cfull.getIndexes().length}`); }
      if (cfull.getIndexes()[1].type !== 'fulltext') { throw new Error(`Cucumber ${cfull.getIndexes()[1].type}`); }
      if (cgeo.getIndexes().length !== 2) { throw new Error(`Jackfruit ${cgeo.getIndexes().length}`); }
      if (cgeo.getIndexes()[1].type !== 'geo') { throw new Error(`Onion ${cgeo.getIndexes()[1].type}`); }
      if (cunique.getIndexes().length !== 2) { throw new Error(`Durian ${cunique.getIndexes().length}`); }
      if (cunique.getIndexes()[1].unique !== true) { throw new Error(`Mandarin ${cunique.getIndexes()[1].unique}`); }
      if (cmulti.getIndexes().length !== 5) { throw new Error(`Leek ${cmulti.getIndexes().length}`); }
      if (cempty.getIndexes().length !== 1) { throw new Error(`Pineapple ${cempty.getIndexes().length}`); }

      // Check data:
      progress("110: checking data");
      if (c.count() !== 1000 * options.dataMultiplier) { throw new Error(`Audi ${c.count()} !== 1000`); }
      if (cpersistent.count() !== 12345 * options.dataMultiplier) { throw new Error(`VW ${cpersistent.count()} !== 12345`); }
      if (cgeo.count() !== 5245 * options.dataMultiplier) { throw new Error(`Mercedes ${cgeo.count()} !== 5245`); }
      if (cfull.count() !== 6253 * options.dataMultiplier) { throw new Error(`Renault ${cfull.count()} !== 6253`); }
      if (cunique.count() !== 5362 * options.dataMultiplier) { throw new Error(`Opel ${cunique.count()} !== 5362`); }
      if (cmulti.count() !== 12346 * options.dataMultiplier) { throw new Error(`Fiat ${cmulti.count()} !== 12346`); }
      if (version_collection.count() !== 1) { throw new Error(`Fiat ${version_collection.count()} !== 1`); }

      // Check a few queries:
      progress("110: query 1");
      runAqlQueryResultCount(aql`FOR x IN ${c} FILTER x.a == "id1001" RETURN x`, 1);
      progress("110: query 2");
      runAqlQueryResultCount(aql`FOR x IN ${cpersistent} FILTER x.a == "id10452" RETURN x`, 1);
      progress("110: query 3");
      runAqlQueryResultCount(aql`FOR x IN ${cempty} RETURN x`, 0);
      if (options.dataMultiplier === 1) {
        progress("110: query 4");
        runAqlQueryResultCount(aql`FOR x IN ${cgeo} FILTER x.a == "id15000" RETURN x`, 1);
        progress("110: query 5");
        runAqlQueryResultCount(aql`FOR x IN ${cunique} FILTER x.a == "id27000" RETURN x`, 1);
        progress("110: query 6");
        runAqlQueryResultCount(aql`FOR x IN ${cmulti} FILTER x.a == "id32847" RETURN x`, 1);
      }
      progress("110: queries done");
      progress("110: done");
    },
    clearData: function (options, isCluster, isEnterprise, dbCount, loopCount, readOnly) {
      print(`${Date()} 110: clearing data ${dbCount} ${loopCount}`);
      progress("110: drop 1");
      try {
        db._drop(`c_${loopCount}`);
      } catch (e) {}
      progress("110: drop 2");
      try {
        db._drop(`cpersistent_${loopCount}`);
      } catch (e) {}
      progress("110: drop 3");
      try {
        db._drop(`cfull_${loopCount}`);
      } catch (e) {}
      progress("110: drop 4");
      try {
        db._drop(`cgeo_${loopCount}`);
      } catch (e) {}
      progress("110: drop 5");
      try {
        db._drop(`cunique_${loopCount}`);
      } catch (e) {}
      progress("110: drop 6");
      try {
        db._drop(`cmulti_${loopCount}`);
      } catch (e) {}
      progress("110: drop 7");
      try {
        db._drop(`cempty_${loopCount}`);
      } catch (e) {}
      progress("110: drop 8");
      try {
        db._drop(`version_collection_${loopCount}`);
      } catch (e) {}
      progress("110: drop done");
    }
  };
}());
