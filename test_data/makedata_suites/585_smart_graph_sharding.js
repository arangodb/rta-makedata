/* global print, progress, db, createSafe, createCollectionSafe, getShardCount, getReplicationFactor, semver, assertEqual */

// //////////////////////////////////////////////////////////////////////////////
// / Creates a SmartGraph with a vertex, an edge and an orphan collection and
// / records which of them was elected to lead the shard distribution.
// /
// / Which collection leads is not deterministic - the vertex or the orphan
// / collection may be picked, only the edge collection never is - so the
// / election result is stored in a collection of its own at creation time.
// / The check verifies both that the collections still form a consistent
// / `distributeShardsLike` group and that the very same collection is still
// / leading it.
// //////////////////////////////////////////////////////////////////////////////

(function () {
  function names(dbCount) {
    return {
      graphName: `sharding_smart_graph_${dbCount}`,
      edges: `sharding_smart_edges_${dbCount}`,
      vertices: `sharding_smart_vertices_${dbCount}`,
      orphans: `sharding_smart_orphans_${dbCount}`,
      meta: `sharding_smart_meta_${dbCount}`
    };
  }
  const metaKey = "distributeShardsLike";

  function isOneShardDB() {
    return db._properties().sharding === "single";
  }

  function getCollection(name) {
    const coll = db._collection(name);
    if (coll === null) {
      throw new Error(`585: collection '${name}' does not exist!`);
    }
    return coll;
  }

  function electedLeader(n) {
    const collections = [n.vertices, n.orphans, n.edges];
    let leaders = {};
    collections.forEach(name => {
      const properties = getCollection(name).properties();
      leaders[name] = (properties.distributeShardsLike === undefined) ? name : properties.distributeShardsLike;
    });
    const leader = leaders[n.vertices];
    collections.forEach(name => {
      if (leaders[name] !== leader) {
        throw new Error(`585: the collections of '${n.graphName}' do not share one shard distribution ` +
                        `leader: ${JSON.stringify(leaders)}`);
      }
    });
    return leader;
  }

  return {
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      let ver = semver.parse(oldVersion.split('-')[0]);
      return enterprise && cluster && semver.gte(ver, "3.11.0");
    },

    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} 585: making per database data ${dbCount}`);
      if (isOneShardDB()) {
        print(`${Date()} 585: skipping one shard database ${database}`);
        return 0;
      }
      const sgm = require('@arangodb/smart-graph');
      const n = names(dbCount);

      createSafe(n.graphName, gn => {
        return sgm._create(gn,
                           [sgm._relation(n.edges, [n.vertices], [n.vertices])],
                           [n.orphans],
                           {
                             numberOfShards: getShardCount(5),
                             replicationFactor: getReplicationFactor(2),
                             smartGraphAttribute: "value"
                           });
      }, gn => {
        return sgm._graph(gn);
      });
      progress(`585: created smart graph ${n.graphName}`);

      const meta = createCollectionSafe(n.meta, 1, 2);
      const leader = electedLeader(n);
      if (!meta.exists(metaKey)) {
        meta.insert({ _key: metaKey, leader: leader });
      }
      progress(`585: '${leader}' leads the shard distribution of ${n.graphName}`);
      return 0;
    },

    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      print(`${Date()} 585: checking per database data ${dbCount}`);
      if (isOneShardDB()) {
        print(`${Date()} 585: skipping one shard database ${database}`);
        return 0;
      }
      const n = names(dbCount);

      const graphsColl = db._collection('_graphs');
      if (!graphsColl.exists(n.graphName)) {
        throw new Error(`585: graph '${n.graphName}' does not exist!`);
      }
      const leader = electedLeader(n);
      const recorded = getCollection(n.meta).document(metaKey).leader;
      assertEqual(leader, recorded, `585: the shard distribution leader of ${n.graphName} changed`);
      progress(`585: checked the shard distribution of ${n.graphName}`);
      return 0;
    },

    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} 585: clearing per database data ${dbCount}`);
      const sgm = require('@arangodb/smart-graph');
      const n = names(dbCount);

      try {
        sgm._drop(n.graphName, true);
        progress(`585: dropped smart graph ${n.graphName}`);
      } catch (e) { }
      try {
        db._drop(n.meta);
        progress(`585: dropped collection ${n.meta}`);
      } catch (e) { }
      return 0;
    }
  };
}());
