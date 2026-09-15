/* global print, progress, db, createCollectionSafe, getValue, assertEqual, assertFalse */

// //////////////////////////////////////////////////////////////////////////////
// / Creates a collection, fills it and truncates it again
// //////////////////////////////////////////////////////////////////////////////

(function () {
  function numDocs() {
    return getValue(10000);
  }

  function truncatedName(dbCount) {
    return `truncated_${dbCount}`;
  }

  return {
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      return true;
    },

    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} 140: making per database data ${dbCount}`);

      const coll = createCollectionSafe(truncatedName(dbCount), 3, 2);
      const count = numDocs();
      let docs = [];
      for (let i = 0; i < count; ++i) {
        docs.push({ _key: `test${i}`, value1: i, value2: "this is a test", value3: `test${i}` });
        if (docs.length === 1000) {
          coll.insert(docs);
          docs = [];
        }
      }
      if (docs.length > 0) {
        coll.insert(docs);
      }
      progress(`140: filled ${truncatedName(dbCount)} with ${count} documents`);

      coll.truncate({ compact: false });
      progress(`140: truncated ${truncatedName(dbCount)}`);
      return 0;
    },

    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      print(`${Date()} 140: checking per database data ${dbCount}`);

      const coll = db._collection(truncatedName(dbCount));
      if (coll === null) {
        throw new Error(`140: collection '${truncatedName(dbCount)}' does not exist!`);
      }
      assertEqual(coll.type(), 2, "the truncated collection should be a document collection");
      assertFalse(coll.properties().waitForSync, "the truncated collection should not have waitForSync");
      assertEqual(coll.indexes().length, 1, `the truncated collection should only have the primary index, has: ${JSON.stringify(coll.indexes())}`);
      assertEqual(coll.indexes()[0].type, "primary", "the truncated collection should only have the primary index");
      assertEqual(coll.count(), 0, "the truncated collection should be empty");
      assertEqual(db._query(`FOR doc IN ${truncatedName(dbCount)} RETURN doc`).toArray().length, 0,
                  "the truncated collection should not return any document");
      progress(`140: checked ${truncatedName(dbCount)}`);
      return 0;
    },

    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} 140: clearing per database data ${dbCount}`);

      try {
        db._drop(truncatedName(dbCount));
        progress(`140: dropped collection ${truncatedName(dbCount)}`);
      } catch (e) { }
      return 0;
    }
  };
}());
