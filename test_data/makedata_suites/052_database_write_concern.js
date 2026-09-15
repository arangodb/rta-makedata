/* global print, progress, db, createUseDatabaseSafe, assertEqual */

// //////////////////////////////////////////////////////////////////////////////
// / Creates a database that carries a non-default `writeConcern` next to its
// / `replicationFactor` and verifies both
// //////////////////////////////////////////////////////////////////////////////

(function () {
  const replicationFactor = 2;
  const writeConcern = 2;

  function propertiesDbName(database, dbCount) {
    const baseName = (database === "_system") ? "system" : database;
    return `${baseName}_${dbCount}_writeconcern`;
  }

  return {
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      return cluster;
    },

    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} 052: making per database data ${dbCount}`);

      const databaseName = propertiesDbName(database, dbCount);
      db._useDatabase('_system');
      if (db._databases().includes(databaseName)) {
        print(`${Date()} 052: skipping ${databaseName} - its already there.`);
        return 0;
      }
      progress(`052: creating database ${databaseName}`);
      createUseDatabaseSafe(databaseName, { replicationFactor: replicationFactor, writeConcern: writeConcern });
      db._useDatabase('_system');
      return 0;
    },

    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      print(`${Date()} 052: checking per database data ${dbCount}`);

      const databaseName = propertiesDbName(database, dbCount);
      db._useDatabase('_system');
      if (!db._databases().includes(databaseName)) {
        throw new Error(`052: database '${databaseName}' does not exist! have: ${db._databases()}`);
      }
      db._useDatabase(databaseName);
      const properties = db._properties();
      if (properties.sharding !== "single") {
        assertEqual(properties.replicationFactor, replicationFactor, `052: replicationFactor of ${databaseName}`);
      }
      assertEqual(properties.writeConcern, writeConcern, `052: writeConcern of ${databaseName}`);
      progress(`052: checked database properties of ${databaseName}`);
      db._useDatabase('_system');
      return 0;
    },

    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} 052: clearing per database data ${dbCount}`);

      const databaseName = propertiesDbName(database, dbCount);
      db._useDatabase('_system');
      try {
        db._dropDatabase(databaseName);
        progress(`052: dropped database ${databaseName}`);
      } catch (e) { }
      return 0;
    }
  };
}());
