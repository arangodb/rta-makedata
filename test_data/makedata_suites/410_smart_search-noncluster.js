/* global print, progress, db, createSafe, getShardCount, getReplicationFactor */

// //////////////////////////////////////////////////////////////////////////////
// / Creates an arangosearch view over a SmartGraph edge collection (Enterprise
// / only). This is the SINGLE SERVER variant: on a single server a smart edge
// / collection is a plain collection without the hidden _from_/_to_/_local_
// / shadow collections, so the view is only linked to the smart edge collection
// / itself.
//
// / The 411_smart_search-cluster.js suite is the cluster counterpart. Both suites
// / operate on the SAME resource names so that the mixed cluster<->single dump
// / scenarios work: the make phase runs against whichever deployment is the dump
// / source (only the matching suite's isSupported() returns true there) and the
// / check phase runs against the restore target (only the matching suite's
// / isSupported() returns true there).
// //////////////////////////////////////////////////////////////////////////////

(function () {
  const analyzers = require("@arangodb/analyzers");
  let gsm;

  // All resource names must contain dbCount to stay unique across database loops. The names are shared with 411_smart_search-cluster.js so that the mixed dump scenarios (make on one deployment, check on the other) find the data again.
  const graphName = (dbCount) => `smart_search_graph_${dbCount}`;
  const edgesName = (dbCount) => `smart_search_edges_${dbCount}`;
  const verticesName = (dbCount) => `smart_search_vertices_${dbCount}`;
  const orphansName = (dbCount) => `smart_search_orphans_${dbCount}`;
  const viewName = (dbCount) => `smart_search_view_${dbCount}`;
  const analyzerName = (dbCount) => `smartCustom_${dbCount}`;

  return {
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      // SmartGraphs and smart edge collections are an Enterprise-only feature.
      if (enterprise && !cluster) {
        gsm = require('@arangodb/smart-graph');
        return true;
      }
      return false;
    },

    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} 410: making data ${dbCount}`);

      // Create a SmartGraph, which provides a smart edge collection to link the arangosearch view against.
      progress(`410: creating smart graph ${graphName(dbCount)}`);
      createSafe(graphName(dbCount), graphName => {
        return gsm._create(graphName,
                           [gsm._relation(edgesName(dbCount),
                                          [verticesName(dbCount)],
                                          [verticesName(dbCount)])],
                           [orphansName(dbCount)],
                           {
                             numberOfShards: getShardCount(3),
                             replicationFactor: getReplicationFactor(2),
                             smartGraphAttribute: "value"
                           });
      }, graphName => {
        return gsm._graph(graphName);
      });

      // Create the custom analyzer used by the view.
      progress(`410: creating analyzer ${analyzerName(dbCount)}`);
      createSafe(analyzerName(dbCount), () => {
        return analyzers.save(analyzerName(dbCount), "delimiter", {delimiter: "smart"}, ["frequency"]);
      }, () => {
        if (analyzers.analyzer(analyzerName(dbCount)) === null) {
          throw new Error(`410: ${analyzerName(dbCount)} analyzer creation failed!`);
        }
      });

      // Create the arangosearch view over the smart edge collection.
      progress(`410: creating view ${viewName(dbCount)}`);
      createSafe(viewName(dbCount), viewName => {
        return db._createView(viewName, "arangosearch", {
          // choose non default values to check if they are correctly dumped and imported
          cleanupIntervalStep: 456,
          consolidationPolicy: {
            threshold: 0.3,
            type: "bytes_accum"
          },
          consolidationIntervalMsec: 0,
          links: {
            [edgesName(dbCount)]: {
              includeAllFields: true,
              fields: {
                text: {analyzers: ["text_en", analyzerName(dbCount)]}
              }
            }
          }
        });
      }, viewName => {
        return db._view(viewName);
      });
      progress('410: createSmartArangoSearch done');
      return 0;
    },

    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      print(`${Date()} 410: checking data ${dbCount}`);

      const edges = edgesName(dbCount);
      const view = db._view(viewName(dbCount));
      if (view === null) {
        throw new Error(`410: view ${viewName(dbCount)} not found`);
      }

      const props = view.properties();
      if (!props.hasOwnProperty("links")) {
        throw new Error(`410: view ${viewName(dbCount)} has no links`);
      }

      const assertLinkedTo = (collName) => {
        if (!props.links.hasOwnProperty(collName)) {
          throw new Error(`410: view ${viewName(dbCount)} is not linked to ${collName} - ${JSON.stringify(props.links)}`);
        }
        const link = props.links[collName];
        if (!link.includeAllFields) {
          throw new Error(`410: link to ${collName} does not include all fields`);
        }
        if (!link.hasOwnProperty("fields") || Object.keys(link.fields).length !== 1) {
          throw new Error(`410: link to ${collName} has unexpected fields - ${JSON.stringify(link.fields)}`);
        }
        if (link.fields.text.analyzers.length !== 2) {
          throw new Error(`410: link to ${collName} has unexpected analyzers - ${JSON.stringify(link.fields.text.analyzers)}`);
        }
      };

      progress(`410: checking link to smart edge collection ${edges}`);
      assertLinkedTo(edges);

      // On a single server a smart edge collection is a plain collection without the hidden _from_/_to_/_local_ shadow collections, so the view must only be linked to the smart edge collection itself.
      progress(`410: checking that no shadow collections are linked`);
      [`_from_${edges}`, `_to_${edges}`, `_local_${edges}`].forEach((collName) => {
        if (props.links.hasOwnProperty(collName)) {
          throw new Error(`410: view ${viewName(dbCount)} should not be linked to shadow collection ${collName} on a single server - ${JSON.stringify(props.links)}`);
        }
      });

      progress(`410: checking view properties of ${viewName(dbCount)}`);
      if (props.consolidationIntervalMsec !== 0) {
        throw new Error(`410: unexpected consolidationIntervalMsec ${props.consolidationIntervalMsec}`);
      }
      if (props.cleanupIntervalStep !== 456) {
        throw new Error(`410: unexpected cleanupIntervalStep ${props.cleanupIntervalStep}`);
      }
      if (Math.abs(props.consolidationPolicy.threshold - 0.3) >= 0.001) {
        throw new Error(`410: unexpected consolidationPolicy threshold ${props.consolidationPolicy.threshold}`);
      }
      if (props.consolidationPolicy.type !== "bytes_accum") {
        throw new Error(`410: unexpected consolidationPolicy type ${props.consolidationPolicy.type}`);
      }
      progress('410: checkSmartArangoSearch done');
      return 0;
    },

    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} 410: clearing data ${dbCount}`);

      progress(`410: dropping view ${viewName(dbCount)}`);
      try {
        db._dropView(viewName(dbCount));
      } catch (ex) {
        print(`${Date()} 410: ${ex} ${ex.stack}`);
      }

      progress(`410: dropping smart graph ${graphName(dbCount)}`);
      try {
        gsm = require("@arangodb/smart-graph");
        gsm._drop(graphName(dbCount), true);
      } catch (ex) {
        print(`${Date()} 410: ${ex} ${ex.stack}`);
      }

      progress(`410: dropping analyzer ${analyzerName(dbCount)}`);
      try {
        analyzers.remove(analyzerName(dbCount), true);
      } catch (ex) {
        print(`${Date()} 410: ${ex} ${ex.stack}`);
      }
      return 0;
    }
  };
}());

