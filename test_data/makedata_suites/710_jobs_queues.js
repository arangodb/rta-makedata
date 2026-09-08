/* global print, progress, db, semver, assertEqual */

// //////////////////////////////////////////////////////////////////////////////
// / Writes an entry into the `_jobs` and the `_queues` system collection
// //////////////////////////////////////////////////////////////////////////////

(function () {
  function entryKey(dbCount) {
    return `rta_makedata_${dbCount}`;
  }

  function getCollection(name) {
    const coll = db._collection(name);
    if (coll === null) {
      throw new Error(`710: system collection '${name}' does not exist!`);
    }
    return coll;
  }

  return {
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      let currentVersionSemver = semver.parse(semver.coerce(currentVersion));
      return semver.lt(currentVersionSemver, "4.0.0");
    },

    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} 710: making per database data ${dbCount}`);
      const key = entryKey(dbCount);

      const jobs = getCollection('_jobs');
      if (!jobs.exists(key)) {
        jobs.insert({ _key: key, status: "completed" });
      }
      progress(`710: created the _jobs entry ${key}`);

      const queues = getCollection('_queues');
      if (!queues.exists(key)) {
        queues.insert({ _key: key });
      }
      progress(`710: created the _queues entry ${key}`);
      return 0;
    },

    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      print(`${Date()} 710: checking per database data ${dbCount}`);
      const key = entryKey(dbCount);

      const job = getCollection('_jobs').document(key);
      assertEqual(job._key, key, "710: the _jobs entry");
      assertEqual(job.status, "completed", "710: the status of the _jobs entry");
      assertEqual(getCollection('_queues').document(key)._key, key, "710: the _queues entry");
      progress(`710: checked the _jobs / _queues entries ${key}`);
      return 0;
    },

    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} 710: clearing per database data ${dbCount}`);
      const key = entryKey(dbCount);

      ['_jobs', '_queues'].forEach(name => {
        try {
          db._collection(name).remove(key);
          progress(`710: removed the ${name} entry ${key}`);
        } catch (e) { }
      });
      return 0;
    }
  };
}());
