/* global print, progress, createCollectionSafe, db, createSafe, semver  */

(function () {
  let extendedNames = ["ᇤ፼ᢟ⚥㑸ন", "に楽しい新習慣", "うっとりとろける", "זַרקוֹר", "ስፖትላይት", "بقعة ضوء", "ուշադրության կենտրոնում", "🌸🌲🌵 🍃💔"];
  return {
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      let currentVersionSemver = semver.parse(semver.coerce(currentVersion));
      let oldVersionSemver = semver.parse(semver.coerce(oldVersion));
      return semver.gte(currentVersionSemver, "3.11.0") && semver.gte(oldVersionSemver, "3.11.0");
    },
    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      // All items created must contain dbCount
      progress(`403: making data ${dbCount}`);
      let viewCollectionName = `old_cview1_${dbCount}${extendedNames[3]}`;
      let cview1 = createCollectionSafe(viewCollectionName, 3, 1);
      progress('403: createView1');
      let viewName1 = `old_view1_403_${dbCount}${extendedNames[6]}`;
      let view1 = createSafe(viewName1,
                             viewname => {
                               return db._createView(viewname, "arangosearch", {});
                             }, viewname => {
                               return db._view(viewname);
                             }
                            );
      progress('403: createView1 done');
      let meta = {
        links: {}
      };
      meta.links[viewCollectionName] = {
        // includeAllFields: true
      };
      view1.properties(meta);

      cview1.insert([
        {"animal": "cat", "name": "tom"},
        {"animal": "mouse", "name": "jerry"},
        {"animal": "dog", "name": "harry"}
      ]);
      progress('403: createView3');
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      progress(`403: checking data ${dbCount}`);
      // Check view:
      let view1 = db._view(`old_view1_403_${dbCount}${extendedNames[6]}`);
      if (!view1.properties().links.hasOwnProperty(`old_cview1_${dbCount}${extendedNames[3]}`)) {
        throw new Error("403: Hass");
      }
      progress(`403: checkdata done`);
    },
    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      progress(`403: cleaning up data ${dbCount}`);

      try {
        db._dropView(`old_view1_403_${dbCount}${extendedNames[6]}`);
      } catch (e) {
        progress(`403: dropping view didn't work: ${e}`);
        throw e;
      }
      progress("403: dropping view");
      try {
        db._drop(`old_cview1_${dbCount}${extendedNames[3]}`);
      } catch (e) {
        progress(`403: cleanup caught ${e}`);
        throw e;
      }
      progress('403: cleanup done');
    }
  };
}());
