/* global print, progress, createCollectionSafe, db, createSafe, semver */

(function () {
  return {
    isSupported: function (version, oldVersion, enterprise, cluster) {
      return semver.gt(oldVersion,  '3.7.0');
    },
    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      // All items created must contain dbCount and dbCount
      print(`401: making data ${dbCount}`);
      let viewCollectionName = `cview1_${dbCount}`;
      let cview1 = createCollectionSafe(viewCollectionName, 3, 1);
      progress('createView1');
      let viewName1 = `view1_${dbCount}`;
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
        includeAllFields: false,
        fields: {
          animal:{},
          name:{}
        }
      };
      view1.properties(meta);

      cview1.insert([
        {"animal": "cat", "name": "tom"},
        {"animal": "mouse", "name": "jerry"},
        {"animal": "dog", "name": "harry"}
      ]);
      progress('401: createView3');
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      print(`401: checking data ${dbCount}`);
      // Check view:
      let view1 = db._view(`view1_${dbCount}`);
      if (!view1.properties().links.hasOwnProperty(`cview1_${dbCount}`)) {
        throw new Error("Hass");
      }
      progress("401: check view");
    },
    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`401: checking data ${dbCount}`);

      try {
        db._dropView(`view1_${dbCount}`);
      } catch (e) {
        print(e);
      }
      progress("401: drop view 1");
      try {
        db._drop(`cview1_${dbCount}`);
      } catch (e) {
        print(e);
      }
      progress("401: drop view 2");
    }
  };
}());
