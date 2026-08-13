/* global print, progress, db, createSafe, getShardCount, getReplicationFactor, semver, assertTrue, assertFalse, assertEqual */

// //////////////////////////////////////////////////////////////////////////////
// / Creates a set of collections that use the padded and uuid key generators and
// / verifies that their key options as well as the generated keys survive a dump /
// / restore / upgrade cycle.
// /
// / Both generators work with an arbitrary number of shards and on both single
// / server and cluster deployments, so the decision whether this suite runs at all
// / is made solely in `isSupported` (based on the server version).
// //////////////////////////////////////////////////////////////////////////////

(function () {
  const numDocs = 1000;

  // Name helpers - every resource carries the dbCount so that parallel runs on multiple databases / loops do not clash.
  function paddedName(dbCount) {
    return `keygen_padded_${dbCount}`;
  }
  function uuidName(dbCount) {
    return `keygen_uuid_${dbCount}`;
  }

  // Creation helpers.
  function createKeygenCollection(collName, options) {
    createSafe(collName, cn => {
      return db._create(cn, options);
    }, cn => {
      return db._collection(cn);
    });
  }

  // Inserts `numDocs` documents, then inserts two more and removes one of them again. This leaves `numDocs + 1` documents behind.
  function fillKeygenCollection(coll, withMore) {
    let docs = [];
    for (let i = 0; i < numDocs; ++i) {
      if (withMore) {
        docs.push({ value: i, more: { value: [i, i] } });
      } else {
        docs.push({ value: i });
      }
    }
    coll.save(docs);
    const d = coll.save({});
    coll.save({}); // create another one in between ...
    coll.remove(d);
  }


  return {
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      let ver = semver.parse(oldVersion.split('-')[0]);
      return semver.gte(ver, "3.10.0");
    },

    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} 121: making per database data ${dbCount}`);

      createKeygenCollection(paddedName(dbCount), {
        numberOfShards: getShardCount(2),
        replicationFactor: getReplicationFactor(2),
        keyOptions: {
          type: "padded",
          allowUserKeys: false
        }
      });
      fillKeygenCollection(db._collection(paddedName(dbCount)), true);
      progress(`121: created padded collection ${paddedName(dbCount)}`);

      createKeygenCollection(uuidName(dbCount), {
        numberOfShards: getShardCount(2),
        replicationFactor: getReplicationFactor(2),
        keyOptions: {
          type: "uuid",
          allowUserKeys: false
        }
      });
      fillKeygenCollection(db._collection(uuidName(dbCount)), false);
      progress(`121: created uuid collection ${uuidName(dbCount)}`);
      return 0;
    },

    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      print(`${Date()} 121: checking per database data ${dbCount}`);

      // padded
      {
        const coll = db._collection(paddedName(dbCount));
        if (coll === null) {
          throw new Error(`121: collection '${paddedName(dbCount)}' does not exist!`);
        }
        const p = coll.properties();
        assertEqual(p.keyOptions.type, "padded", "padded key type");
        assertFalse(p.keyOptions.allowUserKeys, "padded allowUserKeys");

        assertEqual(coll.indexes().length, 1, "padded should only have the primary index");
        assertEqual(coll.indexes()[0].type, "primary", "padded primary index");
        assertEqual(coll.count(), numDocs + 1, "padded document count");

        // The padded keys increase within a single shard - across multiple shards each has its own counter.
        const numberOfShards = p.numberOfShards || 1;

        let allDocs = {};
        let allKeys = {};
        coll.toArray().forEach(doc => {
          if (doc.hasOwnProperty('value')) {
            allDocs[doc.value] = doc;
          }
          // Padded keys are fixed-width, zero-padded, 16-character lowercase hex.
          assertTrue(/^[0-9a-f]{16}$/.test(doc._key), `padded key '${doc._key}' is not a valid padded key`);
          assertFalse(allKeys.hasOwnProperty(doc._key), `duplicate padded key '${doc._key}'`);
          allKeys[doc._key] = true;
        });

        let lastKey = "";
        for (let i = 0; i < numDocs; ++i) {
          const doc = allDocs[i];
          if (numberOfShards === 1) {
            // Keys are monotonically increasing in insertion order on a single shard.
            assertTrue(doc._key > lastKey, `padded key '${doc._key}' should be greater than '${lastKey}'`);
            lastKey = doc._key;
          }
          assertEqual(doc.value, i, "padded document value");
          assertEqual(doc.more, { value: [i, i] }, "padded nested value");
        }

        if (!readOnly) {
          const doc = coll.save({});
          assertTrue(/^[0-9a-f]{16}$/.test(doc._key), `padded key '${doc._key}' is not a valid padded key`);
          assertFalse(allKeys.hasOwnProperty(doc._key), `newly generated padded key '${doc._key}' collides with an existing key`);
          if (numberOfShards === 1) {
            // On a single shard the freshly generated key must continue the sequence.
            assertTrue(doc._key > lastKey, `padded key '${doc._key}' should be greater than '${lastKey}'`);
          }
          coll.remove(doc);
        }
        progress(`121: checked padded collection ${paddedName(dbCount)}`);
      }

      // uuid
      {
        const coll = db._collection(uuidName(dbCount));
        if (coll === null) {
          throw new Error(`121: collection '${uuidName(dbCount)}' does not exist!`);
        }
        const p = coll.properties();
        assertEqual(p.keyOptions.type, "uuid", "uuid key type");
        assertFalse(p.keyOptions.allowUserKeys, "uuid allowUserKeys");

        assertEqual(coll.indexes().length, 1, "uuid should only have the primary index");
        assertEqual(coll.indexes()[0].type, "primary", "uuid primary index");
        assertEqual(coll.count(), numDocs + 1, "uuid document count");

        if (!readOnly) {
          // Verify that newly generated uuid keys do not collide with the ones that were generated during makeData. Remove them again afterwards to keep the check idempotent.
          let existingKeys = {};
          coll.toArray().forEach(doc => {
            existingKeys[doc._key] = true;
          });
          let docs = [];
          for (let i = 0; i < numDocs; ++i) {
            docs.push({ a: i });
          }
          const savedDocs = coll.save(docs);
          savedDocs.forEach(doc => {
            assertFalse(existingKeys.hasOwnProperty(doc._key), `uuid key collision for ${doc._key}`);
          });
          coll.remove(savedDocs.map(doc => doc._key));
        }
        progress(`121: checked uuid collection ${uuidName(dbCount)}`);
      }
      return 0;
    },

    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} 121: clearing per database data ${dbCount}`);

      [paddedName(dbCount), uuidName(dbCount)].forEach(collName => {
        try {
          db._drop(collName);
          progress(`121: dropped collection ${collName}`);
        } catch (e) { }
      });
      return 0;
    }
  };
}());

