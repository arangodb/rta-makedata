/* global print, progress, db, createCollectionSafe, getValue, semver, assertEqual, assertTrue, assertFalse */

// //////////////////////////////////////////////////////////////////////////////
// / Creates and verifies the payload of three transactions
// /   - a transaction that only inserts documents and commits,
// /   - a transaction that updates documents which already existed before it
// /     started and commits,
// /   - a transaction that removes and inserts documents and is rolled back -
// /     it must not leave any trace behind.
// //////////////////////////////////////////////////////////////////////////////

(function () {
  function numDocs() {
    return getValue(1000);
  }

  function commitName(dbCount) {
    return `transaction_commit_${dbCount}`;
  }
  function updateName(dbCount) {
    return `transaction_update_${dbCount}`;
  }
  function abortName(dbCount) {
    return `transaction_abort_${dbCount}`;
  }

  function makeDocs(count) {
    let docs = [];
    for (let i = 0; i < count; ++i) {
      docs.push({ _key: `test${i}`, value1: i, value2: "this is a test", value3: `test${i}` });
    }
    return docs;
  }

  function inTransaction(collName, commit, action) {
    const trx = db._createTransaction({ collections: { write: [collName] } });
    try {
      action(trx.collection(collName));
    } catch (e) {
      trx.abort();
      throw e;
    }
    if (commit) {
      trx.commit();
    } else {
      trx.abort();
    }
  }

  return {
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      return true;
    },

    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} 130: making per database data ${dbCount}`);
      const count = numDocs();

      createCollectionSafe(commitName(dbCount), 3, 2);
      inTransaction(commitName(dbCount), true, (coll) => {
        coll.insert(makeDocs(count));
      });
      progress(`130: filled ${commitName(dbCount)} in a committed transaction`);

      const updateColl = createCollectionSafe(updateName(dbCount), 3, 2);
      updateColl.insert(makeDocs(count));
      inTransaction(updateName(dbCount), true, (coll) => {
        for (let i = 0; i < count; i += 2) {
          coll.update(`test${i}`, { value3: i });
        }
      });
      progress(`130: updated ${updateName(dbCount)} in a committed transaction`);

      const abortColl = createCollectionSafe(abortName(dbCount), 3, 2);
      abortColl.insert({ _key: "foo" });
      inTransaction(abortName(dbCount), false, (coll) => {
        coll.remove("foo");
        coll.insert(makeDocs(count));
      });
      progress(`130: rolled back the transaction on ${abortName(dbCount)}`);
      return 0;
    },

    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      print(`${Date()} 130: checking per database data ${dbCount}`);
      const count = numDocs();

      const getCollection = (name) => {
        const coll = db._collection(name);
        if (coll === null) {
          throw new Error(`130: collection '${name}' does not exist!`);
        }
        return coll;
      };

      const commitColl = getCollection(commitName(dbCount));
      assertEqual(commitColl.count(), count, "committed transaction document count");
      for (let i = 0; i < count; ++i) {
        const doc = commitColl.document(`test${i}`);
        assertEqual(doc.value1, i, "committed transaction value1");
        assertEqual(doc.value2, "this is a test", "committed transaction value2");
        assertEqual(doc.value3, `test${i}`, "committed transaction value3");
      }
      progress(`130: checked ${commitName(dbCount)}`);

      const updateColl = getCollection(updateName(dbCount));
      assertEqual(updateColl.count(), count, "updated transaction document count");
      for (let i = 0; i < count; ++i) {
        const doc = updateColl.document(`test${i}`);
        assertEqual(doc.value1, i, "updated transaction value1");
        assertEqual(doc.value2, "this is a test", "updated transaction value2");
        // Every other document was updated
        assertEqual(doc.value3, (i % 2 === 0) ? i : `test${i}`, "updated transaction value3");
      }
      progress(`130: checked ${updateName(dbCount)}`);

      const abortColl = getCollection(abortName(dbCount));
      assertEqual(abortColl.count(), 1, "aborted transaction document count");
      assertTrue(abortColl.exists("foo"), "the document removed by the aborted transaction is gone");
      assertFalse(abortColl.exists("test0"), "a document inserted by the aborted transaction survived");
      progress(`130: checked ${abortName(dbCount)}`);
      return 0;
    },

    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} 130: clearing per database data ${dbCount}`);

      [commitName(dbCount), updateName(dbCount), abortName(dbCount)].forEach(name => {
        try {
          db._drop(name);
          progress(`130: dropped collection ${name}`);
        } catch (e) { }
      });
      return 0;
    }
  };
}());
