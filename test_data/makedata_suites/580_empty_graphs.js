/* global print, progress, db, createSafe, getShardCount, getReplicationFactor, semver, assertTrue, assertFalse, assertEqual */

// //////////////////////////////////////////////////////////////////////////////
// / Creates a set of "empty" enterprise graphs (graphs with no edge definitions
// / and no orphan collections) as well as a set of graphs that do have their
// / vertex / edge / orphan collections but no documents.
// //////////////////////////////////////////////////////////////////////////////

(function () {
  let sgm;    // @arangodb/smart-graph      (smart + disjoint smart graphs)
  let egm;    // @arangodb/enterprise-graph (enterprise graphs)
  let satgm;  // @arangodb/satellite-graph  (satellite graphs)

  // getReplicationFactor() honours the configured min / max, so creation and the
  // verification below always agree on the same values.
  const effectiveShards = getShardCount(5);
  const effectiveReplicationFactor = getReplicationFactor(2);


  // Name helpers - every resource carries the dbCount so that parallel runs on multiple databases / loops do not clash.
  // Empty graphs (no collections at all).
  function emptyGraphName(kind, dbCount) {
    return `empty_${kind}_graph_${dbCount}`;
  }
  // Graphs that own collections but store no documents.
  function noDataNames(kind, dbCount) {
    return {
      graphName: `${kind}_no_data_graph_${dbCount}`,
      edges: `${kind}_no_data_edges_${dbCount}`,
      vertices: `${kind}_no_data_vertices_${dbCount}`,
      orphans: `${kind}_no_data_orphans_${dbCount}`
    };
  }


  // Creation helpers.
  // Creates a graph without any edge definitions or orphan collections.
  function createEmptyGraph(graphModule, graphName, options) {
    createSafe(graphName, gn => {
      return graphModule._create(gn, [], [], options);
    }, gn => {
      return graphModule._graph(gn);
    });
  }
  // Creates a graph with a single self-relation plus one orphan collection but
  // without inserting any documents.
  function createGraphWithoutData(graphModule, names, options) {
    createSafe(names.graphName, gn => {
      return graphModule._create(
        gn,
        [graphModule._relation(names.edges, [names.vertices], [names.vertices])],
        [names.orphans],
        options
      );
    }, gn => {
      return graphModule._graph(gn);
    });
  }


  // Verification helpers.
  function getGraphDoc(graphName) {
    const graphsColl = db._collection('_graphs');
    if (!graphsColl.exists(graphName)) {
      throw new Error(`580: graph '${graphName}' does not exist!`);
    }
    return graphsColl.document(graphName);
  }


  // Common properties of a smart / disjoint smart graph.
  function checkCommonSmartGraphProperties(graph) {
    assertTrue(graph.isSmart, "graph should be smart");
    assertFalse(graph.isSatellite, "graph should not be satellite");
    assertEqual(graph.replicationFactor, effectiveReplicationFactor, "smart graph replicationFactor");
    assertEqual(graph.numberOfShards, effectiveShards, "smart graph numberOfShards");
    assertEqual(graph.smartGraphAttribute, 'value', "smart graph smartGraphAttribute");
  }

  // Common properties of an enterprise graph.
  function checkCommonEnterpriseGraphProperties(graph) {
    assertTrue(graph.isSmart, "enterprise graph should be smart");
    assertFalse(graph.isSatellite, "enterprise graph should not be satellite");
    assertEqual(graph.replicationFactor, effectiveReplicationFactor, "enterprise graph replicationFactor");
    assertEqual(graph.numberOfShards, effectiveShards, "enterprise graph numberOfShards");
    assertFalse(graph.smartGraphAttribute, "enterprise graph should not have a smartGraphAttribute");
  }

  // Common properties of a satellite graph.
  function checkCommonSatelliteGraphProperties(graph) {
    assertTrue(graph.isSatellite, "graph should be satellite");
    assertFalse(graph.isSmart, "satellite graph should not be smart");
    assertEqual(graph.replicationFactor, "satellite", "satellite graph replicationFactor");
    assertEqual(graph.numberOfShards, 1, "satellite graph numberOfShards");
  }

  // A graph is empty when it neither has edge definitions nor orphan collections.
  function checkEmptyness(graph, graphName) {
    assertEqual(graph.edgeDefinitions.length, 0, `graph '${graphName}' should have no edge definitions`);
    assertEqual(graph.orphanCollections.length, 0, `graph '${graphName}' should have no orphan collections`);
  }

  // Checks that the graph owns the expected collections and that they are empty.
  function checkCollectionsWithoutData(graph, names) {
    assertEqual(graph.edgeDefinitions, [
      {
        "collection": names.edges,
        "from": [names.vertices],
        "to": [names.vertices]
      }
    ], `graph '${names.graphName}' edge definitions`);
    assertEqual(graph.orphanCollections, [names.orphans], `graph '${names.graphName}' orphan collections`);

    for (const collName of [names.vertices, names.orphans, names.edges]) {
      const coll = db._collection(collName);
      if (coll === null) {
        throw new Error(`580: collection '${collName}' of graph '${names.graphName}' does not exist!`);
      }
      if (coll.count() !== 0) {
        throw new Error(`580: collection '${collName}' of graph '${names.graphName}' should be empty but has ${coll.count()} documents`);
      }
    }
  }


  // Descriptions of the graphs created / checked / cleared by this suite.
  // Empty graphs: no edge definitions, no orphan collections.
  function emptyGraphSpecs(dbCount) {
    return [
      {
        module: () => sgm,
        name: emptyGraphName("smart", dbCount),
        options: {
          numberOfShards: effectiveShards,
          replicationFactor: effectiveReplicationFactor,
          smartGraphAttribute: "value"
        },
        check: (graph) => {
          assertFalse(graph.isDisjoint, "empty smart graph should not be disjoint");
          checkCommonSmartGraphProperties(graph);
        }
      },
      {
        module: () => egm,
        name: emptyGraphName("enterprise", dbCount),
        options: {
          numberOfShards: effectiveShards,
          replicationFactor: effectiveReplicationFactor,
          isSmart: true
        },
        check: (graph) => {
          assertFalse(graph.isDisjoint, "empty enterprise graph should not be disjoint");
          checkCommonEnterpriseGraphProperties(graph);
        }
      },
      {
        module: () => satgm,
        name: emptyGraphName("satellite", dbCount),
        options: {
          numberOfShards: effectiveShards,
          replicationFactor: 'satellite'
        },
        check: (graph) => {
          assertFalse(graph.isDisjoint, "empty satellite graph should not be disjoint");
          checkCommonSatelliteGraphProperties(graph);
        }
      },
      {
        module: () => sgm,
        name: emptyGraphName("disjoint", dbCount),
        options: {
          numberOfShards: effectiveShards,
          replicationFactor: effectiveReplicationFactor,
          smartGraphAttribute: "value",
          isDisjoint: true
        },
        check: (graph) => {
          assertTrue(graph.isDisjoint, "empty disjoint graph should be disjoint");
          checkCommonSmartGraphProperties(graph);
        }
      }
    ];
  }

  // Graphs with collections but no documents.
  function noDataGraphSpecs(dbCount) {
    return [
      {
        module: () => sgm,
        names: noDataNames("smart", dbCount),
        options: {
          numberOfShards: effectiveShards,
          replicationFactor: effectiveReplicationFactor,
          smartGraphAttribute: "value"
        },
        check: (graph) => {
          assertFalse(graph.isDisjoint, "smart no-data graph should not be disjoint");
          checkCommonSmartGraphProperties(graph);
        }
      },
      {
        module: () => egm,
        names: noDataNames("enterprise", dbCount),
        options: {
          numberOfShards: effectiveShards,
          replicationFactor: effectiveReplicationFactor,
          isSmart: true
        },
        check: (graph) => {
          assertFalse(graph.isDisjoint, "enterprise no-data graph should not be disjoint");
          checkCommonEnterpriseGraphProperties(graph);
        }
      },
      {
        module: () => satgm,
        names: noDataNames("satellite", dbCount),
        options: {
          numberOfShards: effectiveShards,
          replicationFactor: 'satellite',
          isSatellite: true
        },
        check: (graph) => {
          assertFalse(graph.isDisjoint, "satellite no-data graph should not be disjoint");
          checkCommonSatelliteGraphProperties(graph);
        }
      },
      {
        module: () => sgm,
        names: noDataNames("disjoint", dbCount),
        options: {
          numberOfShards: effectiveShards,
          replicationFactor: effectiveReplicationFactor,
          smartGraphAttribute: "value",
          isDisjoint: true
        },
        check: (graph) => {
          assertTrue(graph.isDisjoint, "disjoint no-data graph should be disjoint");
          checkCommonSmartGraphProperties(graph);
        }
      }
    ];
  }

  return {
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      sgm = require('@arangodb/smart-graph');
      egm = require('@arangodb/enterprise-graph');
      satgm = require('@arangodb/satellite-graph');
      let ver = semver.parse(oldVersion.split('-')[0]);
      return enterprise && semver.gt(ver, "3.12.10");
    },

    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} 580: making per database data ${dbCount}`);

      // Empty graphs (no edge definitions, no orphan collections).
      emptyGraphSpecs(dbCount).forEach(spec => {
        createEmptyGraph(spec.module(), spec.name, spec.options);
        progress(`580: created empty graph ${spec.name}`);
      });

      // Graphs with collections but without any documents.
      noDataGraphSpecs(dbCount).forEach(spec => {
        createGraphWithoutData(spec.module(), spec.names, spec.options);
        progress(`580: created graph without data ${spec.names.graphName}`);
      });
      return 0;
    },

    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      print(`${Date()} 580: checking per database data ${dbCount}`);

      emptyGraphSpecs(dbCount).forEach(spec => {
        const graph = getGraphDoc(spec.name);
        spec.check(graph);
        checkEmptyness(graph, spec.name);
        progress(`580: checked empty graph ${spec.name}`);
      });

      noDataGraphSpecs(dbCount).forEach(spec => {
        const graph = getGraphDoc(spec.names.graphName);
        spec.check(graph);
        checkCollectionsWithoutData(graph, spec.names);
        progress(`580: checked graph without data ${spec.names.graphName}`);
      });
      return 0;
    },

    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} 580: clearing per database data ${dbCount}`);

      const smartGraph = require('@arangodb/smart-graph');
      const enterpriseGraph = require('@arangodb/enterprise-graph');
      const satelliteGraph = require('@arangodb/satellite-graph');

      const dropSpecs = [
        { module: smartGraph, name: emptyGraphName("smart", dbCount) },
        { module: enterpriseGraph, name: emptyGraphName("enterprise", dbCount) },
        { module: satelliteGraph, name: emptyGraphName("satellite", dbCount) },
        { module: smartGraph, name: emptyGraphName("disjoint", dbCount) },
        { module: smartGraph, name: noDataNames("smart", dbCount).graphName },
        { module: enterpriseGraph, name: noDataNames("enterprise", dbCount).graphName },
        { module: satelliteGraph, name: noDataNames("satellite", dbCount).graphName },
        { module: smartGraph, name: noDataNames("disjoint", dbCount).graphName }
      ];

      dropSpecs.forEach(spec => {
        try {
          spec.module._drop(spec.name, true);
          progress(`580: dropped graph ${spec.name}`);
        } catch (e) { }
      });
      return 0;
    }
  };
}());

