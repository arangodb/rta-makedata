/* global print, progress, db, createCollectionSafe, getValue, semver, assertEqual, assertTrue, assertFalse */

// //////////////////////////////////////////////////////////////////////////////
// / The JS transaction counterpart of `130_transactions.js`: the same payload,
// / but driven through `db._executeTransaction()` - a single request carrying a
// / server side JS `action` - instead of the streaming transaction API.
// /   - a transaction that only inserts documents and commits,
// /   - a transaction that updates documents which already existed before it
// /     started and commits,
// /   - a transaction that removes and inserts documents and is rolled back by
// /     throwing out of its action - it must not leave any trace behind.
// //////////////////////////////////////////////////////////////////////////////

(function () {
  function numDocs() {
    return getValue(1000);
  }

  function commitName(dbCount) {
    return `js_transaction_commit_${dbCount}`;
  }
  function updateName(dbCount) {
    return `js_transaction_update_${dbCount}`;
  }
  function abortName(dbCount) {
    return `js_transaction_abort_${dbCount}`;
  }

  function makeDocs(count) {
    let docs = [];
    for (let i = 0; i < count; ++i) {
      docs.push({ _key: `test${i}`, value1: i, value2: "this is a test", value3: `test${i}` });
    }
    return docs;
  }

  return {
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      let currentVersionSemver = semver.parse(semver.coerce(currentVersion));
      return semver.lt(currentVersionSemver, "4.0.0");
    },

    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} 131: making per database data ${dbCount}`);
      const count = numDocs();

      const commitColl = createCollectionSafe(commitName(dbCount), 3, 2);
      if (commitColl.count() === 0) {
        const inserted = db._executeTransaction({
          collections: { write: [commitName(dbCount)] },
          action: function (params) {
            const db = require('@arangodb').db;
            const coll = db._collection(params.coll);
            let docs = [];
            for (let i = 0; i < params.count; ++i) {
              docs.push({ _key: `test${i}`, value1: i, value2: "this is a test", value3: `test${i}` });
            }
            coll.insert(docs);
            return coll.count();
          },
          params: { coll: commitName(dbCount), count: count }
        });
        assertEqual(inserted, count, "131: the return value of the committed action");
      }
      progress(`131: filled ${commitName(dbCount)} in a committed JS transaction`);

      const updateColl = createCollectionSafe(updateName(dbCount), 3, 2);
      if (updateColl.count() === 0) {
        updateColl.insert(makeDocs(count));
        db._executeTransaction({
          collections: { write: [updateName(dbCount)] },
          action: function (params) {
            const db = require('@arangodb').db;
            const coll = db._collection(params.coll);
            for (let i = 0; i < params.count; i += 2) {
              coll.update(`test${i}`, { value3: i });
            }
          },
          params: { coll: updateName(dbCount), count: count }
        });
      }
      progress(`131: updated ${updateName(dbCount)} in a committed JS transaction`);

      const abortColl = createCollectionSafe(abortName(dbCount), 3, 2);
      if (!abortColl.exists("foo")) {
        abortColl.insert({ _key: "foo" });
      }
      let rolledBack = false;
      try {
        db._executeTransaction({
          collections: { write: [abortName(dbCount)] },
          action: function (params) {
            const db = require('@arangodb').db;
            const coll = db._collection(params.coll);
            coll.remove("foo");
            let docs = [];
            for (let i = 0; i < params.count; ++i) {
              docs.push({ _key: `test${i}`, value1: i, value2: "this is a test", value3: `test${i}` });
            }
            coll.insert(docs);
            throw new Error("131: rollback");
          },
          params: { coll: abortName(dbCount), count: count }
        });
      } catch (e) {
        rolledBack = true;
      }
      assertTrue(rolledBack, `131: the action of ${abortName(dbCount)} should have thrown`);
      progress(`131: rolled back the JS transaction on ${abortName(dbCount)}`);
      return 0;
    },

    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      print(`${Date()} 131: checking per database data ${dbCount}`);
      const count = numDocs();

      const getCollection = (name) => {
        const coll = db._collection(name);
        if (coll === null) {
          throw new Error(`131: collection '${name}' does not exist!`);
        }
        return coll;
      };

      const commitColl = getCollection(commitName(dbCount));
      assertEqual(commitColl.count(), count, "131: committed transaction document count");
      for (let i = 0; i < count; ++i) {
        const doc = commitColl.document(`test${i}`);
        assertEqual(doc.value1, i, "131: committed transaction value1");
        assertEqual(doc.value2, "this is a test", "131: committed transaction value2");
        assertEqual(doc.value3, `test${i}`, "131: committed transaction value3");
      }
      progress(`131: checked ${commitName(dbCount)}`);

      const updateColl = getCollection(updateName(dbCount));
      assertEqual(updateColl.count(), count, "131: updated transaction document count");
      for (let i = 0; i < count; ++i) {
        const doc = updateColl.document(`test${i}`);
        assertEqual(doc.value1, i, "131: updated transaction value1");
        assertEqual(doc.value2, "this is a test", "131: updated transaction value2");
        // Every other document was updated
        assertEqual(doc.value3, (i % 2 === 0) ? i : `test${i}`, "131: updated transaction value3");
      }
      progress(`131: checked ${updateName(dbCount)}`);

      const abortColl = getCollection(abortName(dbCount));
      assertEqual(abortColl.count(), 1, "131: aborted transaction document count");
      assertTrue(abortColl.exists("foo"),
                 "131: the document removed by the aborted transaction should be back");
      assertFalse(abortColl.exists("test0"),
                  "131: a document inserted by the aborted transaction survived");
      progress(`131: checked ${abortName(dbCount)}`);
      return 0;
    },

    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} 131: clearing per database data ${dbCount}`);

      [commitName(dbCount), updateName(dbCount), abortName(dbCount)].forEach(name => {
        try {
          db._drop(name);
          progress(`131: dropped collection ${name}`);
        } catch (e) { }
      });
      return 0;
    }
  };
}());
