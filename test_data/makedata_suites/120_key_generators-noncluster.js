/* global print, progress, db, createSafe, getReplicationFactor, semver, assertFalse, assertTrue, assertEqual */

// //////////////////////////////////////////////////////////////////////////////
// / Creates a collection that uses the autoincrement key generator and verifies
// / that its key options as well as the generated keys survive a dump / restore /
// / upgrade cycle.
// /
// / The autoincrement generator only works with a single shard and its last used
// / value is only deterministic on a single server. Therefore the decision whether
// / this suite runs at all is made solely in `isSupported` (single server only).
// //////////////////////////////////////////////////////////////////////////////

(function () {
  const autoIncOffset = 7;
  const autoIncIncrement = 42;
  const numDocs = 1000;

  // Name helpers - every resource carries the dbCount so that parallel runs on multiple databases / loops do not clash.
  function autoIncName(dbCount) {
    return `keygen_autoinc_${dbCount}`;
  }

  // Creation helpers.
  function createKeygenCollection(collName, options) {
    createSafe(collName, cn => {
      return db._create(cn, options);
    }, cn => {
      return db._collection(cn);
    });
  }

  // Inserts `numDocs` documents, then inserts two more and removes one of them again. This leaves `numDocs + 1` documents behind and advances the last used value in a deterministic way.
  function fillKeygenCollection(coll) {
    let docs = [];
    for (let i = 0; i < numDocs; ++i) {
      docs.push({ value: i, more: { value: [i, i] } });
    }
    coll.save(docs);
    const d = coll.save({});
    coll.save({}); // create another one in between ...
    coll.remove(d);
  }


  return {
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      // The autoincrement generator only works with a single shard and its last
      // used value is only deterministic on a single server, so this suite only
      // runs on single server deployments.
      if (cluster) {
        return false;
      }
      let ver = semver.parse(oldVersion.split('-')[0]);
      return semver.gte(ver, "3.10.0");
    },

    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} 120: making per database data ${dbCount}`);

      // autoincrement: only works with a single shard.
      createKeygenCollection(autoIncName(dbCount), {
        numberOfShards: 1,
        replicationFactor: getReplicationFactor(2),
        keyOptions: {
          type: "autoincrement",
          allowUserKeys: false,
          offset: autoIncOffset,
          increment: autoIncIncrement
        }
      });
      fillKeygenCollection(db._collection(autoIncName(dbCount)));
      progress(`120: created autoincrement collection ${autoIncName(dbCount)}`);
      return 0;
    },

    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      print(`${Date()} 120: checking per database data ${dbCount}`);

      const coll = db._collection(autoIncName(dbCount));
      if (coll === null) {
        throw new Error(`120: collection '${autoIncName(dbCount)}' does not exist!`);
      }
      const p = coll.properties();
      assertEqual(p.keyOptions.type, "autoincrement", "autoincrement key type");
      assertFalse(p.keyOptions.allowUserKeys, "autoincrement allowUserKeys");
      assertEqual(p.keyOptions.offset, autoIncOffset, "autoincrement offset");
      assertEqual(p.keyOptions.increment, autoIncIncrement, "autoincrement increment");

      assertEqual(coll.indexes().length, 1, "autoincrement should only have the primary index");
      assertEqual(coll.indexes()[0].type, "primary", "autoincrement primary index");
      assertEqual(coll.count(), numDocs + 1, "autoincrement document count");

      for (let i = 0; i < numDocs; ++i) {
        const key = String(autoIncOffset + (i * autoIncIncrement));
        const doc = coll.document(key);
        assertEqual(doc._key, key, "autoincrement generated key");
        assertEqual(doc.value, i, "autoincrement document value");
        assertEqual(doc.more, { value: [i, i] }, "autoincrement nested value");
      }

      // The last used value is deterministic on a single server (this suite only runs on single server, see isSupported). Saving the additional document below advances the persistent lastValue by one increment, and removing the document again does NOT roll that value back. Since checkDataDB is executed multiple times during a dump / restore / upgrade cycle, the lastValue only grows across runs. We therefore assert that it is at least the value produced by makeData and that it stays on the expected grid (offset + n * increment), rather than expecting a fixed value.
      if (!readOnly) {
        const minLastValue = autoIncOffset + ((numDocs + 1) * autoIncIncrement);
        const lastValue = p.keyOptions.lastValue;
        assertTrue(lastValue >= minLastValue, `autoincrement lastValue (${lastValue}) is below the expected minimum (${minLastValue})`);
        assertEqual((lastValue - autoIncOffset) % autoIncIncrement, 0, "autoincrement lastValue is not on the expected grid");
        // Insert one more document to verify that the generator continues from the current lastValue, then remove it again.
        const doc = coll.save({});
        assertEqual(doc._key, String(lastValue + autoIncIncrement), "autoincrement next generated key");
        coll.remove(doc);
      }
      progress(`120: checked autoincrement collection ${autoIncName(dbCount)}`);
      return 0;
    },

    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} 120: clearing per database data ${dbCount}`);

      try {
        db._drop(autoIncName(dbCount));
        progress(`120: dropped collection ${autoIncName(dbCount)}`);
      } catch (e) { }
      return 0;
    }
  };
}());

