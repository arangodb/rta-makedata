/* global print, progress, db, _, createSafe, createCollectionSafe, semver, assertTrue, assertEqual */

// //////////////////////////////////////////////////////////////////////////////
// /   - a standalone collection with `replicationFactor: "satellite"`, i.e. one
// /     that is not part of any graph,
// /   - a SatelliteGraph over two vertices, two edge and one orphan collection
// /     holding a cycle of 100 vertices.
// //////////////////////////////////////////////////////////////////////////////

(function () {
  const numVertices = 100;

  function names(dbCount) {
    return {
      collection: `satellite_collection_${dbCount}`,
      graphName: `satellite_graph_${dbCount}`,
      vertices1: `satellite_vertices1_${dbCount}`,
      vertices2: `satellite_vertices2_${dbCount}`,
      orphans: `satellite_orphans_${dbCount}`,
      edges1: `satellite_edges1_${dbCount}`,
      edges2: `satellite_edges2_${dbCount}`
    };
  }

  function isOneShardDB() {
    return db._properties().sharding === "single";
  }

  function getCollection(name) {
    const coll = db._collection(name);
    if (coll === null) {
      throw new Error(`575: collection '${name}' does not exist!`);
    }
    return coll;
  }

  return {
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      let ver = semver.parse(oldVersion.split('-')[0]);
      return enterprise && cluster && semver.gte(ver, "3.11.0");
    },

    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} 575: making per database data ${dbCount}`);
      if (isOneShardDB()) {
        print(`${Date()} 575: skipping one shard database ${database}`);
        return 0;
      }
      const satgm = require('@arangodb/satellite-graph');
      const n = names(dbCount);

      const coll = createCollectionSafe(n.collection, 1, 2, { replicationFactor: "satellite" });
      if (coll.count() === 0) {
        let docs = [];
        for (let i = 0; i < numVertices; ++i) {
          docs.push({ _key: `v${i}`, value: String(i) });
        }
        coll.insert(docs);
      }
      progress(`575: created satellite collection ${n.collection}`);

      createSafe(n.graphName, gn => {
        const graph = satgm._create(gn, [], [n.vertices1]);
        graph._extendEdgeDefinitions(satgm._relation(n.edges1, n.vertices1, n.vertices2));
        graph._extendEdgeDefinitions(satgm._relation(n.edges2, n.vertices2, n.vertices1));
        graph._addVertexCollection(n.orphans, true);
        return graph;
      }, gn => {
        return satgm._graph(gn);
      });
      progress(`575: created satellite graph ${n.graphName}`);

      if (db._collection(n.vertices1).count() === 0) {
        // A cycle over `numVertices` vertices spread over both vertex col's:
        // vertices1 holds the uneven ones, vertices2 the even ones,
        // edges1 goes from uneven to even and edges2 the other way around.
        // The orphan collection gets `numVertices` documents of its own.
        db._query(`
          FOR i IN 1..${numVertices}
            LET vertexKey = CONCAT("v", i)
            LET unevenVertices = (
              FILTER i % 2 == 1
              INSERT { _key: vertexKey }
                INTO @@vertexCol1
            )
            LET evenVertices = (
              FILTER i % 2 == 0
              INSERT { _key: vertexKey }
                INTO @@vertexCol2
            )
            LET from = CONCAT(i % 2 == 1 ? @vertexCol1 : @vertexCol2, "/v", i)
            LET to = CONCAT((i+1) % 2 == 1 ? @vertexCol1 : @vertexCol2, "/v", i % ${numVertices} + 1)
            LET unevenEdges = (
              FILTER i % 2 == 1
              INSERT { _from: from, _to: to }
                INTO @@edgeCol1
            )
            LET evenEdges = (
              FILTER i % 2 == 0
              INSERT { _from: from, _to: to }
                INTO @@edgeCol2
            )
            INSERT { _key: CONCAT("w", i) }
              INTO @@orphanCol
        `, {
          '@vertexCol1': n.vertices1,
          '@vertexCol2': n.vertices2,
          'vertexCol1': n.vertices1,
          'vertexCol2': n.vertices2,
          '@edgeCol1': n.edges1,
          '@edgeCol2': n.edges2,
          '@orphanCol': n.orphans
        });
      }
      progress(`575: filled satellite graph ${n.graphName}`);
      return 0;
    },

    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      print(`${Date()} 575: checking per database data ${dbCount}`);
      if (isOneShardDB()) {
        print(`${Date()} 575: skipping one shard database ${database}`);
        return 0;
      }
      const satgm = require('@arangodb/satellite-graph');
      const n = names(dbCount);

      const coll = getCollection(n.collection);
      assertEqual(coll.properties().replicationFactor, "satellite", `575: replicationFactor of ${n.collection}`);
      assertEqual(coll.count(), numVertices, `575: document count of ${n.collection}`);
      assertEqual(coll.document("v7").value, "7", `575: document contents of ${n.collection}`);
      progress(`575: checked satellite collection ${n.collection}`);

      const graph = satgm._graph(n.graphName);
      assertEqual(Object.keys(graph._vertexCollections(true)).sort(), [n.vertices1, n.vertices2].sort(),
                  `575: vertex collections of ${n.graphName}`);
      assertEqual(graph._orphanCollections().sort(), [n.orphans], `575: orphan collections of ${n.graphName}`);
      assertEqual(graph._edgeCollections().map(c => c.name()).sort(), [n.edges1, n.edges2].sort(),
                  `575: edge collections of ${n.graphName}`);

      const graphDoc = db._collection('_graphs').document(n.graphName);
      const cmp = (a, b) => (a.collection < b.collection) ? -1 : ((a.collection === b.collection) ? 0 : 1);
      assertEqual(graphDoc.edgeDefinitions.slice().sort(cmp), [
        { collection: n.edges1, from: [n.vertices1], to: [n.vertices2] },
        { collection: n.edges2, from: [n.vertices2], to: [n.vertices1] }
      ].sort(cmp), `575: edge definitions of ${n.graphName}`);
      progress(`575: checked the definition of ${n.graphName}`);

      [n.vertices1, n.vertices2, n.orphans, n.edges1, n.edges2].forEach(name => {
        assertEqual(getCollection(name).properties().replicationFactor, "satellite",
                    `575: replicationFactor of ${name}`);
      });
      assertTrue(getCollection(n.vertices1).properties().distributeShardsLike === undefined,
                 `575: ${n.vertices1} should lead the shard distribution, but follows ` +
                 `${getCollection(n.vertices1).properties().distributeShardsLike}`);
      [n.vertices2, n.orphans, n.edges1, n.edges2].forEach(name => {
        assertEqual(getCollection(name).properties().distributeShardsLike, n.vertices1,
                    `575: distributeShardsLike leader of ${name}`);
      });
      progress(`575: checked the shard distribution of ${n.graphName}`);

      const getVertices = `FOR d IN @@col SORT TO_NUMBER(SUBSTRING(d._key, 1)) RETURN d._key`;
      assertEqual(db._query(getVertices, { '@col': n.vertices1 }).toArray(),
                  _.range(1, numVertices + 1, 2).map(i => `v${i}`), `575: contents of ${n.vertices1}`);
      assertEqual(db._query(getVertices, { '@col': n.vertices2 }).toArray(),
                  _.range(2, numVertices + 1, 2).map(i => `v${i}`), `575: contents of ${n.vertices2}`);
      assertEqual(db._query(getVertices, { '@col': n.orphans }).toArray(),
                  _.range(1, numVertices + 1, 1).map(i => `w${i}`), `575: contents of ${n.orphans}`);

      const getEdges = `
        FOR e IN @@col
          LET from = PARSE_IDENTIFIER(e._from).key
          LET to = PARSE_IDENTIFIER(e._to).key
          SORT TO_NUMBER(SUBSTRING(from, 1)), TO_NUMBER(SUBSTRING(to, 1))
          RETURN [from, to]`;
      assertEqual(db._query(getEdges, { '@col': n.edges1 }).toArray(),
                  _.range(1, numVertices + 1, 2).map(i => [`v${i}`, `v${i % numVertices + 1}`]),
                  `575: contents of ${n.edges1}`);
      assertEqual(db._query(getEdges, { '@col': n.edges2 }).toArray(),
                  _.range(2, numVertices + 1, 2).map(i => [`v${i}`, `v${i % numVertices + 1}`]),
                  `575: contents of ${n.edges2}`);

      const path = db._query(`
        FOR v, e, p IN ${numVertices} OUTBOUND "${n.vertices1}/v1" GRAPH "${n.graphName}"
          RETURN p.vertices[*]._key`).toArray();
      assertEqual(path, [_.range(0, numVertices + 1).map(i => `v${i % numVertices + 1}`)],
                  `575: traversal over ${n.graphName}`);
      progress(`575: checked the contents of ${n.graphName}`);
      return 0;
    },

    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} 575: clearing per database data ${dbCount}`);
      const satgm = require('@arangodb/satellite-graph');
      const n = names(dbCount);

      try {
        satgm._drop(n.graphName, true);
        progress(`575: dropped satellite graph ${n.graphName}`);
      } catch (e) { }
      try {
        db._drop(n.collection);
        progress(`575: dropped satellite collection ${n.collection}`);
      } catch (e) { }
      return 0;
    }
  };
}());
