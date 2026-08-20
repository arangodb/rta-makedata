/* global print, progress, db, createSafe, getShardCount, getReplicationFactor, semver, assertTrue, assertEqual */

// //////////////////////////////////////////////////////////////////////////////
// / Creates a SmartGraph where `_graphs` entry is carries the `initialCid`
// / attribute that 3.11 and older wrote for every SmartGraph.
// /
// / Current versions do not write that attribute anymore, but they still have
// / to be able to restore a graph definition that has it
// //////////////////////////////////////////////////////////////////////////////

(function () {
  function names(dbCount) {
    const graphName = `smart_compat_graph_${dbCount}`;
    return {
      graphName: graphName,
      edges: `smart_compat_edges_${dbCount}`,
      vertices: `smart_compat_vertices_${dbCount}`,
      orphans: `smart_compat_orphans_${dbCount}`,
      newEdges: `${graphName}_new_edges`,
      newVertices: `${graphName}_new_vertices`
    };
  }

  return {
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      let ver = semver.parse(oldVersion.split('-')[0]);
      return enterprise && semver.gt(ver, "3.12.10");
    },

    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} 551: making per database data ${dbCount}`);
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
      progress(`551: created smart graph ${n.graphName}`);

      const leader = db._collection(n.vertices).properties().distributeShardsLike || n.vertices;
      const cid = db._collection(leader)._id;
      db._collection('_graphs').update(n.graphName, { initialCid: cid });
      progress(`551: faked the legacy initialCid of ${n.graphName}`);
      return 0;
    },

    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      print(`${Date()} 551: checking per database data ${dbCount}`);
      const sgm = require('@arangodb/smart-graph');
      const n = names(dbCount);

      const graphsColl = db._collection('_graphs');
      if (!graphsColl.exists(n.graphName)) {
        throw new Error(`551: graph '${n.graphName}' does not exist!`);
      }
      const graphDoc = graphsColl.document(n.graphName);
      assertTrue(graphDoc.isSmart, `551: '${n.graphName}' should be smart`);
      assertEqual(graphDoc.smartGraphAttribute, "value", `551: smartGraphAttribute of '${n.graphName}'`);

      const alreadyExtended = db._collection(n.newEdges) !== null;
      if (!alreadyExtended) {
        assertTrue(graphDoc.hasOwnProperty('initialCid'),
                   `551: '${n.graphName}' lost the faked legacy initialCid: ${JSON.stringify(graphDoc)}`);
        assertEqual(db._collection(n.newVertices), null, `551: '${n.newVertices}' should not exist yet`);
      }

      if (!readOnly && !alreadyExtended) {
        const graph = sgm._graph(n.graphName);
        graph._extendEdgeDefinitions(sgm._relation(n.newEdges, [n.vertices], [n.newVertices]));
        progress(`551: extended the edge definitions of ${n.graphName}`);
      }

      if (db._collection(n.newEdges) !== null) {
        assertTrue(db._collection(n.newEdges).properties().isSmart, `551: '${n.newEdges}' should be smart`);
        assertTrue(db._collection(n.newVertices).properties().isSmart, `551: '${n.newVertices}' should be smart`);
      }
      progress(`551: checked smart graph ${n.graphName}`);
      return 0;
    },

    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} 551: clearing per database data ${dbCount}`);
      const sgm = require('@arangodb/smart-graph');
      const n = names(dbCount);

      try {
        sgm._drop(n.graphName, true);
        progress(`551: dropped smart graph ${n.graphName}`);
      } catch (e) { }
      [n.newEdges, n.newVertices].forEach(name => {
        try {
          db._drop(name);
        } catch (e) { }
      });
      return 0;
    }
  };
}());
