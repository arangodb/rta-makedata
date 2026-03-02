/* global print,  db, progress, createCollectionSafe, createIndexSafe, time, rand, semver, aql, runAqlQueryResultCount, assertCollectionCount, assertIndexType, assertIndexCount, writeData, resetRCount, getValue, isInstrumented */

(function () {
  let extendedNames = ["ᇤ፼ᢟ⚥㑸ন", "に楽しい新習慣", "うっとりとろける", "זַרקוֹר", "ስፖትላይት", "بقعة ضوء", "ուշադրության կենտրոնում", "🌸🌲🌵 🍃💔"];
  let baseName;
  return {
    // This file uses hash and skiplist indexes which are deprecated in 4.0+
    // makeData/makeDataFinalize run on 3.12 (version < 4.0) and create hash/skiplist indexes.
    // checkData runs only on current version < 4.0 (not after upgrade). For post-upgrade on 4.0, 112_collection_utf8.js checkData verifies indexes were converted to persistent.
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      let currentVersionSemver = semver.parse(semver.coerce(currentVersion));
      let oldVersionSemver = semver.parse(semver.coerce(oldVersion));
      return semver.gte(currentVersionSemver, "3.11.0") && semver.gte(oldVersionSemver, "3.11.0") && semver.lt(currentVersionSemver, "4.0.0");
    },
    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      db._useDatabase('_system');
      baseName = database;
      if (baseName === "_system") {
        baseName = "system";
      }
      baseName = `M${baseName}_${dbCount}_${extendedNames[3]}`;
      print(`${Date()} 102: creating ${baseName}`);
      db._createDatabase(baseName);
      db._useDatabase(baseName);
      let c = createCollectionSafe(`c_${dbCount}${extendedNames[0]}`, 3, 2);
      progress('102: createCollection1');
      let chash = createCollectionSafe(`chash_${dbCount}${extendedNames[1]}`, 3, 2);
      progress('102: createCollection2');
      let cskip = createCollectionSafe(`cskip_${dbCount}${extendedNames[2]}`, 1, 1);
      progress('102: createCollection3');
      let cfull = createCollectionSafe(`cfull_${dbCount}${extendedNames[3]}`, 3, 1);
      progress('102: createCollection4');
      let cgeo = createCollectionSafe(`cgeo_${dbCount}${extendedNames[4]}`, 3, 2);
      progress('102: createCollectionGeo5');
      let cunique = createCollectionSafe(`cunique_${dbCount}${extendedNames[5]}`, 1, 1);
      progress('102: createCollection6');
      let cmulti = createCollectionSafe(`cmulti_${dbCount}${extendedNames[6]}`, 3, 2);
      progress('102: createCollection7');
      let cempty = createCollectionSafe(`cempty_${dbCount}${extendedNames[7]}`, 3, 1);
    },
    makeData: function (options, isCluster, isEnterprise, dbCount, loopCount) {
      // All items created must contain dbCount and loopCount
      // Create a few collections:
      db._useDatabase('_system');
      print(`${Date()} 102: using ${baseName}`);
      db._useDatabase(baseName);
      let c = db[`c_${dbCount}${extendedNames[0]}`];
      let chash = db[`chash_${dbCount}${extendedNames[1]}`];
      let cskip = db[`cskip_${dbCount}${extendedNames[2]}`];
      let cfull = db[`cfull_${dbCount}${extendedNames[3]}`];
      let cgeo = db[`cgeo_${dbCount}${extendedNames[4]}`];
      let cunique = db[`cunique_${dbCount}${extendedNames[5]}`];
      let cmulti = db[`cmulti_${dbCount}${extendedNames[6]}`];
      let cempty = db[`cempty_${dbCount}${extendedNames[7]}`];

      // Now the actual data writing:
      resetRCount();
      writeData(c, getValue(1000));
      progress('102: writeData1');
      writeData(chash, getValue(12345));
      progress('102: writeData2');
      writeData(cskip, getValue(2176));
      progress('102: writeData3');
      writeData(cgeo, getValue(5245));
      progress('102: writeData4');
      writeData(cfull, getValue(6253));
      progress('102: writeData5');
      writeData(cunique, getValue(5362));
      progress('102: writeData6');
      writeData(cmulti, getValue(12346));
      progress('102: writeData7');
      db._useDatabase('_system');
    },
    makeDataFinalize: function (options, isCluster, isEnterprise, dbCount) {
      // Create some indexes:
      db._useDatabase('_system');
      print(`${Date()} 102: finalizing ${baseName}`);
      db._useDatabase(baseName);
      let c = db[`c_${dbCount}${extendedNames[0]}`];
      let chash = db[`chash_${dbCount}${extendedNames[1]}`];
      let cskip = db[`cskip_${dbCount}${extendedNames[2]}`];
      let cfull = db[`cfull_${dbCount}${extendedNames[3]}`];
      let cgeo = db[`cgeo_${dbCount}${extendedNames[4]}`];
      let cunique = db[`cunique_${dbCount}${extendedNames[5]}`];
      let cmulti = db[`cmulti_${dbCount}${extendedNames[6]}`];
      let cempty = db[`cempty_${dbCount}${extendedNames[7]}`];
      progress('102: createCollection8');
      createIndexSafe({col: chash, type: "hash", fields: ["a"], unique: false, name: extendedNames[1]});
      progress('102: createIndexHash1');
      createIndexSafe({col: cskip, type: "skiplist", fields: ["a"], unique: false, name: extendedNames[2]});
      progress('102: createIndexSkiplist2');
      createIndexSafe({col: cfull, type: "fulltext", fields: ["text"], minLength: 4, name: extendedNames[3]});
      progress('102: createIndexFulltext3');
      createIndexSafe({col: cgeo, type: "geo", fields: ["position"], geoJson: true, name: extendedNames[4]});
      progress('102: createIndexGeo4');
      createIndexSafe({col: cunique, type: "hash", fields: ["a"], unique: true, name: extendedNames[5]});
      progress('102: createIndex5');
      createIndexSafe({col: cmulti, type: "hash", fields: ["a"], unique: false, name: extendedNames[6]});
      progress('102: createIndex6');
      createIndexSafe({col: cmulti, type: "skiplist", fields: ["b", "c"], name: extendedNames[7]});
      progress('102: createIndex7');
      createIndexSafe({col: cmulti, type: "geo", fields: ["position"], geoJson: true, name: extendedNames[8]});
      progress('102: createIndexGeo8');
      createIndexSafe({col: cmulti, type: "fulltext", fields: ["text"], minLength: 6, name: extendedNames[0]});
      progress('102: createIndexFulltext9');

    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      db._useDatabase('_system');
      baseName = database;
      if (baseName === "_system") {
        baseName = "system";
      }
      baseName = `M${baseName}_${dbCount}_${extendedNames[3]}`;
      print(`${Date()} 102: using ${baseName}`);
    },
    checkData: function (options, isCluster, isEnterprise, dbCount, loopCount, readOnly) {
      print(`${Date()} 102: checking data ${dbCount} ${loopCount}`);
      print(`${Date()} 102: using ${baseName}`);
      db._useDatabase(baseName);
      let cols = db._collections();
      let cnames = [];
      db._collections().forEach(col => { cnames.push(col.name());});
      let allFound = true;
      let notFound = [];
      [`c_${dbCount}${extendedNames[0]}`,
       `chash_${dbCount}${extendedNames[1]}`,
       `cskip_${dbCount}${extendedNames[2]}`,
       `cfull_${dbCount}${extendedNames[3]}`,
       `cgeo_${dbCount}${extendedNames[4]}`,
       `cunique_${dbCount}${extendedNames[5]}`,
       `cmulti_${dbCount}${extendedNames[6]}`,
       `cempty_${dbCount}${extendedNames[7]}`].forEach(colname => {
         let foundOne = false;
         cnames.forEach(oneColName => {
           if (oneColName === colname) {
             foundOne = true;
           }
         });
         if (!foundOne) {
           print(`${Date()} 102: Didn't find this collection: ${colname}`);
           notFound.push(colname);
           allFound = false;
         }
       });
      if (!allFound) {
        throw new Error(`not all collections were present on the system!: ${notFound} All collections: ${cnames}`);
      }

      let c = db._collection(`c_${dbCount}${extendedNames[0]}`);
      let chash = db._collection(`chash_${dbCount}${extendedNames[1]}`);
      let cskip = db._collection(`cskip_${dbCount}${extendedNames[2]}`);
      let cfull = db._collection(`cfull_${dbCount}${extendedNames[3]}`);
      let cgeo = db._collection(`cgeo_${dbCount}${extendedNames[4]}`);
      let cunique = db._collection(`cunique_${dbCount}${extendedNames[5]}`);
      let cmulti = db._collection(`cmulti_${dbCount}${extendedNames[6]}`);
      let cempty = db._collection(`cempty_${dbCount}${extendedNames[7]}`);

      // Check indexes:
      progress("102: checking indices");

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
      progress("102: checking counts");
      assertCollectionCount(c, getValue(1000) * options.dataMultiplier);
      assertCollectionCount(chash, getValue(12345) * options.dataMultiplier);
      assertCollectionCount(cskip, getValue(2176) * options.dataMultiplier);
      assertCollectionCount(cgeo, getValue(5245) * options.dataMultiplier);
      assertCollectionCount(cfull, getValue(6253) * options.dataMultiplier);
      assertCollectionCount(cunique, getValue(5362) * options.dataMultiplier);
      assertCollectionCount(cmulti, getValue(12346) * options.dataMultiplier);
      assertCollectionCount(cmulti, getValue(12346) * options.dataMultiplier);

      // Check a few queries:
      progress("102: query 1");
      let searchID = isInstrumented? "id101":"id1001";
      runAqlQueryResultCount(aql`FOR x IN ${c} FILTER x.a == ${searchID} RETURN x`, 1);
      progress("102: query 3");
      searchID = isInstrumented? "id105":"id10452";
      runAqlQueryResultCount(aql`FOR x IN ${chash} FILTER x.a == ${searchID} RETURN x`, 1);
      progress("102: query 3");
      searchID = "id" + (isInstrumented? 1339 : 13948 * options.dataMultiplier);
      runAqlQueryResultCount(aql`FOR x IN ${cskip} FILTER x.a == ${searchID} RETURN x`,  1);
      progress("102: query 4");
      runAqlQueryResultCount(aql`FOR x IN ${cempty} RETURN x`, 0);
      progress("102: query 5");
      searchID = "id" + (isInstrumented? 2075 : 20473 * options.dataMultiplier);
      runAqlQueryResultCount(aql`FOR x IN ${cgeo} FILTER x.a == ${searchID} RETURN x`, 1);
      progress("102: query 6");
      searchID = "id" + (isInstrumented? 2709 : 32236 * options.dataMultiplier);
      runAqlQueryResultCount(aql`FOR x IN ${cunique} FILTER x.a == ${searchID} RETURN x`, 1);
      progress("102: query 7");
      searchID = "id" + (isInstrumented? 3245 : 32847 * options.dataMultiplier);
      runAqlQueryResultCount(aql`FOR x IN ${cmulti} FILTER x.a == ${searchID} RETURN x`, 1);
      progress("102: queries done");
      db._useDatabase('_system');
    },
    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} 102: clearing ${dbCount}`);
      db._useDatabase('_system');
      baseName = database;
      if (baseName === "_system") {
        baseName = "system";
      }
      db._dropDatabase(`M${baseName}_${dbCount}_${extendedNames[3]}`);
    }
    // we drop the whole db, so no further cleanup needed
  };
}());
