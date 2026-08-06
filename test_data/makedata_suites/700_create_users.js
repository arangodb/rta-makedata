/* global print, progress, db */

// //////////////////////////////////////////////////////////////////////////////
// / Creates a user and verifies its permissions
// //////////////////////////////////////////////////////////////////////////////

(function () {
  const users = require("@arangodb/users");
  const passwd = "foobarpasswd";

  const userName = (dbCount) => `foobaruser_${dbCount}`;

  return {
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      // User management is available in all deployments.
      return true;
    },

    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} 700: making data ${dbCount}`);
      const uName = userName(dbCount);

      progress(`700: creating user ${uName}`);
      // users.save throws if the user already exists, hence guard it so that subsequent runs do not fail.
      if (!users.exists(uName)) {
        users.save(uName, passwd, true);
      }

      progress(`700: granting permissions to ${uName} on ${database}`);
      users.grantDatabase(uName, database, "rw");
      users.grantCollection(uName, database, "*", "rw");
      progress('700: createUsers done');
      return 0;
    },

    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      print(`${Date()} 700: checking data ${dbCount}`);
      const uName = userName(dbCount);

      progress(`700: checking existence of user ${uName}`);
      if (!users.exists(uName)) {
        throw new Error(`700: user ${uName} does not exist`);
      }

      progress(`700: checking permissions of user ${uName}`);
      const dbPermission = users.permission(uName, database);
      if (dbPermission !== 'rw') {
        throw new Error(`700: user ${uName} was expected to have 'rw' on ${database}, but has '${dbPermission}'`);
      }

      progress(`700: validating credentials of user ${uName}`);
      if (!users.isValid(uName, passwd)) {
        throw new Error(`700: credentials of user ${uName} are not valid`);
      }
      progress('700: checkUsers done');
      return 0;
    },

    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} 700: clearing data ${dbCount}`);
      const uName = userName(dbCount);
      try {
        users.remove(uName);
      } catch (ex) {
        print(`${Date()} 700: ${ex} ${ex.stack}`);
      }
      progress(`700: dropped user ${uName}`);
      return 0;
    }
  };
}());

