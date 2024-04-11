/* global print, progress, createCollectionSafe, db, createUseDatabaseSafe, semver , arango */

(function () {
  return {
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      // OldVersion is optional and used in case of upgrade.
      // It resambles the version we are upgradeing from
      // Current is the version of the database we are attached to
      if (oldVersion === "") {
        oldVersion = currentVersion;
      }
      let old = semver.parse(semver.coerce(oldVersion));
      return  enterprise && cluster && semver.gte(old, "3.7.7");
    },
    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      // All items created must contain dbCount
      print(`900: oneShard making per database data ${dbCount}`);
      let baseName = database;
      if (baseName === "_system") {
        baseName = "system";
      }
      progress('Start create OneShard DB');
      print('#ix');
      const databaseName = `${baseName}_${dbCount}_oneShard`;
      const created = createUseDatabaseSafe(databaseName, {sharding: "single"});
      if (db._properties().sharding !== "single") {
        throw new Error(`900: created database ${databaseName} ==? ${arango.getDatabaseName()} isn't single shard: ${JSON.stringify(db._properties())}`);
      }
      if (!created) {
        // its already wrongly there - skip this one.
        throw new Error(`900: skipping ${databaseName} - it failed to be created, or it is not of type one-shard.`);
      }
      progress(`created OneShard DB '${databaseName}'`);
      for (let ccount = 0; ccount < options.collectionMultiplier; ++ccount) {
        const c0 = createCollectionSafe(`c_${ccount}_0`, 1, 2);
        const c1 = createCollectionSafe(`c_${ccount}_1`, 1, 2);
        c0.save({
          _key: "knownKey",
          value: "success"
        });
        c1.save({
          _key: "knownKey",
          value: "success"
        });
      }
      db._useDatabase('_system');
      progress('stored OneShard Data');
      return 0;
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      let baseName = database;
      if (baseName === "_system") {
        baseName = "system";
      }
      progress("Test OneShard setup");
      const databaseName = `${baseName}_${dbCount}_oneShard`;
      print('900: oneshard vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv ' + databaseName);
      db._useDatabase(databaseName);
      for (let ccount = 0; ccount < options.collectionMultiplier; ++ccount) {
        const query = `
      LET testee = DOCUMENT("c_${ccount}_0/knownKey")
      FOR x IN c_${ccount}_1
        RETURN {v1: testee.value, v2: x.value}
      `;
        let result;
        try {
          result = db._query(query).toArray();
        } catch (ex) {
          print(`Failed to instanciate query ${query} -> ${ex}`);
          throw ex;
        }
        if (result.length !== 1 || result[0].v1 !== "success" || result[0].v2 !== "success") {
          throw new Error("DOCUMENT call in OneShard database does not return data " + JSON.stringify(result));
        }
      }
      db._useDatabase('_system');
      return 0;
    },
    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      // check per DB
      progress("900: Test OneShard teardown");
      if (database === "_system") {
        database = "system";
      }
      let baseName = database;
      const databaseName = `${baseName}_${dbCount}_oneShard`;
      db._useDatabase('_system');
      db._dropDatabase(databaseName);

      return 0;
    },
  };
}());
