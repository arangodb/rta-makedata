/* global print,  db, progress, createCollectionSafe, createIndexSafe, time, rand, semver, aql, runAqlQueryResultCount, writeData, resetRCount */

(function () {
  let extendedNames = ["ᇤ፼ᢟ⚥㑸ন", "に楽しい新習慣", "うっとりとろける", "זַרקוֹר", "ስፖትላይት", "بقعة ضوء", "ուշադրության կենտրոնում", "🌸🌲🌵 🍃💔"];
  let baseName;
  return {
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      let currentVersionSemver = semver.parse(semver.coerce(currentVersion));
      let oldVersionSemver = semver.parse(semver.coerce(oldVersion));
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
      // Create a few collections:
      print(`${Date()} 112: using ${baseName}`);
      db._useDatabase(baseName);
      let c = createCollectionSafe(`c_${loopCount}${extendedNames[0]}`, 3, 2);
      progress('112: createCollection1');
      let chash = createCollectionSafe(`chash_${loopCount}${extendedNames[1]}`, 3, 2);
      progress('112: createCollection2');
      let cskip = createCollectionSafe(`cskip_${loopCount}${extendedNames[2]}`, 1, 1);
      progress('112: createCollection3');
      let cfull = createCollectionSafe(`cfull_${loopCount}${extendedNames[3]}`, 3, 1);
      progress('112: createCollection4');
      let cgeo = createCollectionSafe(`cgeo_${loopCount}${extendedNames[4]}`, 3, 2);
      progress('112: createCollectionGeo5');
      let cunique = createCollectionSafe(`cunique_${loopCount}${extendedNames[5]}`, 1, 1);
      progress('112: createCollection6');
      let cmulti = createCollectionSafe(`cmulti_${loopCount}${extendedNames[6]}`, 3, 2);
      progress('112: createCollection7');
      let cempty = createCollectionSafe(`cempty_${loopCount}${extendedNames[7]}`, 3, 1);

      // Create some indexes:
      progress('112: createCollection8');
      createIndexSafe({col: chash, type: "persistent", fields: ["a"], unique: false, name: extendedNames[1]});
      progress('112: createIndexPersistent1');
      createIndexSafe({col: cskip, type: "persistent", fields: ["a"], unique: false, name: extendedNames[2]});
      progress('112: createIndexPersistent2');
      createIndexSafe({col: cfull, type: "fulltext", fields: ["text"], minLength: 4, name: extendedNames[3]});
      progress('112: createIndexFulltext3');
      createIndexSafe({col: cgeo, type: "geo", fields: ["position"], geoJson: true, name: extendedNames[4]});
      progress('112: createIndexGeo4');
      createIndexSafe({col: cunique, type: "persistent", fields: ["a"], unique: true, name: extendedNames[5]});
      progress('112: createIndex5');
      createIndexSafe({col: cmulti, type: "persistent", fields: ["a"], unique: false, name: extendedNames[6]});
      progress('112: createIndex6');
      createIndexSafe({col: cmulti, type: "persistent", fields: ["b", "c"], name: extendedNames[7]});
      progress('112: createIndex7');
      createIndexSafe({col: cmulti, type: "geo", fields: ["position"], geoJson: true, name: extendedNames[8]});
      progress('112: createIndexGeo8');
      createIndexSafe({col: cmulti, type: "fulltext", fields: ["text"], minLength: 6, name: extendedNames[0]});
      progress('112: createIndexFulltext9');

      // Now the actual data writing:
      resetRCount();
      writeData(c, 1000);
      progress('112: writeData1');
      writeData(chash, 12345);
      progress('112: writeData2');
      writeData(cskip, 2176);
      progress('112: writeData3');
      writeData(cgeo, 5245);
      progress('112: writeData4');
      writeData(cfull, 6253);
      progress('112: writeData5');
      writeData(cunique, 5362);
      progress('112: writeData6');
      writeData(cmulti, 12346);
      progress('112: writeData7');
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
      print(`${Date()} 112: checking data ${dbCount} ${loopCount}`);
      print(`${Date()} 112: using ${baseName}`);
      db._useDatabase(baseName);
      let cols = db._collections();
      let cnames = [];
      db._collections().forEach(col => { cnames.push(col.name());});
      let allFound = true;
      let notFound = [];
      [`c_${loopCount}${extendedNames[0]}`,
       `chash_${loopCount}${extendedNames[1]}`,
       `cskip_${loopCount}${extendedNames[2]}`,
       `cfull_${loopCount}${extendedNames[3]}`,
       `cgeo_${loopCount}${extendedNames[4]}`,
       `cunique_${loopCount}${extendedNames[5]}`,
       `cmulti_${loopCount}${extendedNames[6]}`,
       `cempty_${loopCount}${extendedNames[7]}`].forEach(colname => {
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

      let c = db._collection(`c_${loopCount}${extendedNames[0]}`);
      let chash = db._collection(`chash_${loopCount}${extendedNames[1]}`);
      let cskip = db._collection(`cskip_${loopCount}${extendedNames[2]}`);
      let cfull = db._collection(`cfull_${loopCount}${extendedNames[3]}`);
      let cgeo = db._collection(`cgeo_${loopCount}${extendedNames[4]}`);
      let cunique = db._collection(`cunique_${loopCount}${extendedNames[5]}`);
      let cmulti = db._collection(`cmulti_${loopCount}${extendedNames[6]}`);
      let cempty = db._collection(`cempty_${loopCount}${extendedNames[7]}`);

      // Check indexes:
      progress("112: checking indices");

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
      progress("112: checking counts");
      if (c.count() !== 1000 * options.dataMultiplier) { throw new Error(`Audi ${c.count()} !== 1000`); }
      if (chash.count() !== 12345 * options.dataMultiplier) { throw new Error(`VW ${chash.count()} !== 12345`); }
      if (cskip.count() !== 2176 * options.dataMultiplier) { throw new Error(`Tesla ${cskip.count()} !== 2176`); }
      if (cgeo.count() !== 5245 * options.dataMultiplier) { throw new Error(`Mercedes ${cgeo.count()} !== 5245`); }
      if (cfull.count() !== 6253 * options.dataMultiplier) { throw new Error(`Renault ${cfull.count()} !== 6253`); }
      if (cunique.count() !== 5362 * options.dataMultiplier) { throw new Error(`Opel ${cunique.count()} !== 5362`); }
      if (cmulti.count() !== 12346 * options.dataMultiplier) { throw new Error(`Fiat ${cmulti.count()} !== 12346`); }
      if (cmulti.count() !== 12346 * options.dataMultiplier) { throw new Error(`Fiat ${cmulti.count()} !== 12346`); }

      // Check a few queries:
      progress("112: query 1");
      runAqlQueryResultCount(aql`FOR x IN ${c} FILTER x.a == "id1001" RETURN x`, 1);
      progress("112: query 3");
      runAqlQueryResultCount(aql`FOR x IN ${chash} FILTER x.a == "id10452" RETURN x`, 1);
      progress("112: query 3");
      let searchId = "id" + (13948 * options.dataMultiplier);
      runAqlQueryResultCount(aql`FOR x IN ${cskip} FILTER x.a == ${searchId} RETURN x`,  1);
      progress("112: query 4");
      runAqlQueryResultCount(aql`FOR x IN ${cempty} RETURN x`, 0);
      progress("112: query 5");
      searchId = "id" + (20473 * options.dataMultiplier);
      runAqlQueryResultCount(aql`FOR x IN ${cgeo} FILTER x.a == ${searchId} RETURN x`, 1);
      progress("112: query 6");
      searchId = "id" + (32236 * options.dataMultiplier);
      runAqlQueryResultCount(aql`FOR x IN ${cunique} FILTER x.a == ${searchId} RETURN x`, 1);
      progress("112: query 7");
      searchId = "id" + (32847 * options.dataMultiplier);
      runAqlQueryResultCount(aql`FOR x IN ${cmulti} FILTER x.a == ${searchId} RETURN x`, 1);
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
