/* global print, semver, db, progress, createUseDatabaseSafe */

(function () {
  let extendedDbNames = ["ᇤ፼ᢟ⚥㑸ন", "に楽しい新習慣", "うっとりとろける", "זַרקוֹר", "ስፖትላይት", "بقعة ضوء", "ուշադրության կենտրոնում", "🌸🌲🌵 🍃💔"];
  return {
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      let currentVersionSemver = semver.parse(semver.coerce(currentVersion));
      let oldVersionSemver = semver.parse(semver.coerce(oldVersion));
      return semver.gte(currentVersionSemver, "3.9.0") && semver.gte(oldVersionSemver, "3.9.0");
    },

    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print("051: Create databases with unicode symbols in the name");
      let baseName = database;
      if (baseName === "_system") {
        baseName = "system";
      }
      db._useDatabase("_system");
      for (let i in extendedDbNames) {
        let unicodeName = extendedDbNames[i];
        let databaseName = `${baseName}_${dbCount}_${unicodeName}`;
        progress('051: Start creating database ' + databaseName);
        let dbcOptions = {};
        if (isCluster) {
          dbcOptions = { replicationFactor: 2};
        }
        createUseDatabaseSafe(databaseName, dbcOptions);
      }
      return 0;
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      // check per DB
      db._useDatabase('_system');
      const allDatabases = db._databases();
      let baseName = database;
      if (baseName === "_system") {
        baseName = "system";
      }
      progress("051: Test databases with extended unicode symbols in the name");
      for (let i in extendedDbNames) {
        let unicodeName = extendedDbNames[i];
        let databaseName = `${baseName}_${dbCount}_${unicodeName}`;
        progress('051: Checking the existence of the database: ' + databaseName);
        if (!(allDatabases.includes(databaseName))) {
          throw new Error("051: Database does not exist: " + databaseName + "have: " + db._databases());
        }
      }
      db._useDatabase('_system');
      return 0;
    },
    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      progress(`051: Delete databases with unicode symbols in the name ${database} ${dbCount}`);
      if (database === "_system") {
        database = "system";
      }
      let baseName = database;
      for (let i in extendedDbNames) {
        let unicodeName = extendedDbNames[i];
        let databaseName = `${baseName}_${dbCount}_${unicodeName}`;
        db._useDatabase('_system');
        print(`051: dropping ${databaseName}`);
        db._dropDatabase(databaseName);
      }
      return 0;
    }
  };

}());
