/* global print, progress, createCollectionSafe, db, createSafe  */

(function () {
  return {
    isSupported: function (version, oldVersion, enterprise, cluster) {
      return true;
    },
    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      // All items created must contain dbCount and loopCount
      print(`400: making data ${dbCount}`);
      let viewCollectionName = `old_cview1_${dbCount}`;
      let cview1 = createCollectionSafe(viewCollectionName, 3, 1);
      progress('createView1');
      let viewName1 = `old_view1_${dbCount}`;
      let view1 = createSafe(viewName1,
                             viewname => {
                               return db._createView(viewname, "arangosearch", {});
                             }, viewname => {
                               return db._view(viewname);
                             }
                            );
      progress('createView2');
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
      progress('createView3');
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      print(`400: checking data ${dbCount}`);
      // Check view:
      let view1 = db._view(`old_view1_${dbCount}`);
      if (!view1.properties().links.hasOwnProperty(`old_cview1_${dbCount}`)) {
        throw new Error("Hass");
      }
      progress("400: view properties");
    },
    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`400: checking data ${dbCount}`);

      try {
        db._dropView(`old_view1_${dbCount}`);
      } catch (e) {
        print(`400: ${e}`);
      }
      progress("400: drop view1");
      try {
        db._drop(`old_cview1_${dbCount}`);
      } catch (e) {
        print(`400: ${e}`);
      }
      progress("400: drop view2");
    }
  };
}());
