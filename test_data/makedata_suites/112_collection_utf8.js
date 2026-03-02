/* global print, db, progress, createCollectionSafe, createIndexSafe, assertCollectionCount, assertIndexType, assertIndexCount, time, rand, semver, aql, runAqlQueryResultCount, writeData, resetRCount, getValue, isInstrumented */

// This is the ArangoDB 4.0+ version of 102_collection_utf8.js
// In 4.0, hash and skiplist indexes are converted to persistent.
// makeData runs only on 4.0+ (not on 3.12). checkData runs after upgrade on 4.0 and verifies that indexes created by 102 (hash/skiplist) are now persistent.

(function () {
  let extendedNames = ["ᇤ፼ᢟ⚥㑸ন", "に楽しい新習慣", "うっとりとろける", "זַרקוֹר", "ስፖትላይት", "بقعة ضوء", "ուշադրության կենտրոնում", "🌸🌲🌵 🍃💔"];
  let baseName;
  return {
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      let currentVersionSemver = semver.parse(semver.coerce(currentVersion));
      return semver.gte(currentVersionSemver, "4.0.0");
    },
    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      db._useDatabase('_system');
      baseName = database;
      if (baseName === "_system") {
        baseName = "system";
      }
      baseName = `M${baseName}_${dbCount}_${extendedNames[3]}`;
      print(`${Date()} 112: creating ${baseName}`);
      db._createDatabase(baseName);
    },
    makeData: function (options, isCluster, isEnterprise, dbCount, loopCount) {
      // All items created must contain dbCount and loopCount
      // Create collections:
      print(`${Date()} 112: using ${baseName}`);
      db._useDatabase(baseName);
      let c = createCollectionSafe(`c_${loopCount}${extendedNames[0]}`, 3, 2);
      progress('112: createCollection1');
      let cpersistent = createCollectionSafe(`cpersistent_${loopCount}${extendedNames[1]}`, 3, 2);
      progress('112: createCollection2');
      let cfull = createCollectionSafe(`cfull_${loopCount}${extendedNames[3]}`, 3, 1);
      progress('112: createCollection3');
      let cgeo = createCollectionSafe(`cgeo_${loopCount}${extendedNames[4]}`, 3, 2);
      progress('112: createCollectionGeo4');
      let cunique = createCollectionSafe(`cunique_${loopCount}${extendedNames[5]}`, 1, 1);
      progress('112: createCollection5');
      let cmulti = createCollectionSafe(`cmulti_${loopCount}${extendedNames[6]}`, 3, 2);
      progress('112: createCollection6');
      let cempty = createCollectionSafe(`cempty_${loopCount}${extendedNames[7]}`, 3, 1);

      // Create indexes:
      progress('112: createCollection7');
      createIndexSafe({col: cpersistent, type: "persistent", fields: ["a"], unique: false, name: extendedNames[1]});
      progress('112: createIndexPersistent1');
      createIndexSafe({col: cgeo, type: "geo", fields: ["position"], geoJson: true, name: extendedNames[4]});
      progress('112: createIndexGeo3');
      createIndexSafe({col: cunique, type: "persistent", fields: ["a"], unique: true, name: extendedNames[5]});
      progress('112: createIndex4');
      createIndexSafe({col: cmulti, type: "persistent", fields: ["a"], unique: false, name: extendedNames[6]});
      progress('112: createIndex5');
      createIndexSafe({col: cmulti, type: "persistent", fields: ["b", "c"], name: extendedNames[7]});
      progress('112: createIndex6');
      createIndexSafe({col: cmulti, type: "geo", fields: ["position"], geoJson: true, name: extendedNames[0]});
      progress('112: createIndexGeo7');

      // Now the actual data writing:
      resetRCount();
      writeData(c, 1000);
      progress('112: writeData1');
      writeData(cpersistent, 12345);
      progress('112: writeData2');
      writeData(cgeo, 5245);
      progress('112: writeData3');
      writeData(cfull, 6253);
      progress('112: writeData4');
      writeData(cunique, 5362);
      progress('112: writeData5');
      writeData(cmulti, 12346);
      progress('112: writeData6');
      db._useDatabase('_system');
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      db._useDatabase('_system');
      baseName = database;
      if (baseName === "_system") {
        baseName = "system";
      }
      baseName = `M${baseName}_${dbCount}_${extendedNames[3]}`;
      print(`${Date()} 112: using ${baseName}`);
    },
    checkData: function (options, isCluster, isEnterprise, dbCount, loopCount, readOnly) {
      // Post-upgrade check: data was created by 102 on 3.12 (chash_, cskip_, etc.). Verify indexes are now persistent.
      print(`${Date()} 112: checking data ${dbCount} ${loopCount}`);
      print(`${Date()} 112: using ${baseName}`);
      db._useDatabase(baseName);
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
           print(`${Date()} 112: Didn't find this collection: ${colname}`);
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

      // Check indexes (hash/skiplist from 102 are now persistent in 4.0):
      progress("112: checking indices");

      assertIndexCount(c, 1);
      assertIndexCount(chash, 2);
      assertIndexType(chash, 1, 'persistent');
      assertIndexCount(cskip, 2);
      assertIndexType(cskip, 1, 'persistent');
      assertIndexCount(cfull, 1);
      assertIndexCount(cgeo, 2);
      assertIndexType(cgeo, 1, 'geo');
      assertIndexCount(cunique, 2);
      assertIndexType(cunique, 1, 'persistent');
      assertIndexCount(cmulti, 4);
      assertIndexType(cmulti, 1, 'persistent');
      assertIndexType(cmulti, 2, 'persistent');
      assertIndexCount(cempty, 1);

      // Verify no fulltext indexes remain after upgrade to 4.0
      [cfull, cmulti].forEach(col => {
        col.getIndexes().forEach(idx => {
          if (idx.type === 'fulltext') {
            throw new Error(`112: fulltext index still exists on ${col.name()} after upgrade to 4.0!`);
          }
        });
      });

      if (cunique.getIndexes()[1].unique !== true) { throw new Error(`Mandarin ${cunique.getIndexes()[1].unique}`); }

      // Check data:
      progress("112: checking counts");
      assertCollectionCount(c, getValue(1000) * options.dataMultiplier);
      assertCollectionCount(chash, getValue(12345) * options.dataMultiplier);
      assertCollectionCount(cskip, getValue(2176) * options.dataMultiplier);
      assertCollectionCount(cgeo, getValue(5245) * options.dataMultiplier);
      assertCollectionCount(cfull, getValue(6253) * options.dataMultiplier);
      assertCollectionCount(cunique, getValue(5362) * options.dataMultiplier);
      assertCollectionCount(cmulti, getValue(12346) * options.dataMultiplier);

      // Check a few queries (match 102's query logic):
      progress("112: query 1");
      let searchID = isInstrumented ? "id101" : "id1001";
      runAqlQueryResultCount(aql`FOR x IN ${c} FILTER x.a == ${searchID} RETURN x`, 1);
      progress("112: query 2");
      searchID = isInstrumented ? "id105" : "id10452";
      runAqlQueryResultCount(aql`FOR x IN ${chash} FILTER x.a == ${searchID} RETURN x`, 1);
      progress("112: query 3");
      searchID = "id" + (isInstrumented ? 1339 : 13948 * options.dataMultiplier);
      runAqlQueryResultCount(aql`FOR x IN ${cskip} FILTER x.a == ${searchID} RETURN x`, 1);
      progress("112: query 4");
      runAqlQueryResultCount(aql`FOR x IN ${cempty} RETURN x`, 0);
      progress("112: query 5");
      searchID = "id" + (isInstrumented ? 2075 : 20473 * options.dataMultiplier);
      runAqlQueryResultCount(aql`FOR x IN ${cgeo} FILTER x.a == ${searchID} RETURN x`, 1);
      progress("112: query 6");
      searchID = "id" + (isInstrumented ? 2709 : 32236 * options.dataMultiplier);
      runAqlQueryResultCount(aql`FOR x IN ${cunique} FILTER x.a == ${searchID} RETURN x`, 1);
      progress("112: query 7");
      searchID = "id" + (isInstrumented ? 3245 : 32847 * options.dataMultiplier);
      runAqlQueryResultCount(aql`FOR x IN ${cmulti} FILTER x.a == ${searchID} RETURN x`, 1);
      progress("112: queries done");
      db._useDatabase('_system');
    },
    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} 112: clearing ${dbCount}`);
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
