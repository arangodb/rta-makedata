/* global print, progress, db, createSafe, getReplicationFactor, semver, assertTrue, assertFalse, assertEqual */

// //////////////////////////////////////////////////////////////////////////////
// / Creates the two hybrid SmartGraph graphs that mix vertex collections:
// /   - a plain hybrid SmartGraph with one satellite and one smart vertex
// /     collection connected by one edge relation,
// /   - a disjoint hybrid SmartGraph with one satellite and two smart vertex
// /     collections connected by two edge relations.
// //////////////////////////////////////////////////////////////////////////////

(function () {
  const size = 50;

  function hybridNames(dbCount) {
    return {
      graphName: `hybrid_smart_graph_${dbCount}`,
      verticesSat: `hybrid_smart_vertices_sat_${dbCount}`,
      verticesNonSat: `hybrid_smart_vertices_${dbCount}`,
      edges: `hybrid_smart_edges_${dbCount}`,
      orphans: `hybrid_smart_orphans_${dbCount}`
    };
  }
  function disjointNames(dbCount) {
    return {
      graphName: `hybrid_disjoint_graph_${dbCount}`,
      verticesSat: `hybrid_disjoint_vertices_sat_${dbCount}`,
      verticesANonSat: `hybrid_disjoint_vertices_a_${dbCount}`,
      verticesBNonSat: `hybrid_disjoint_vertices_b_${dbCount}`,
      edgesSatA: `hybrid_disjoint_edges_sat_a_${dbCount}`,
      edgesAB: `hybrid_disjoint_edges_a_b_${dbCount}`,
      orphans: `hybrid_disjoint_orphans_${dbCount}`
    };
  }

  function getCollection(name) {
    const coll = db._collection(name);
    if (coll === null) {
      throw new Error(`590: collection '${name}' does not exist!`);
    }
    return coll;
  }

  function fillVertices(collName) {
    let vDocs = [];
    for (let i = 0; i < size; ++i) {
      vDocs.push({ value: String(i) });
    }
    return { saved: getCollection(collName).insert(vDocs).map(v => v._id), vDocs: vDocs };
  }

  function checkSmartCollection(collName, isDisjoint, isCluster, replicationFactor) {
    const properties = getCollection(collName).properties();
    assertTrue(properties.isSmart, `590: '${collName}' should be smart`);
    assertEqual(properties.isDisjoint, isDisjoint, `590: isDisjoint of '${collName}'`);
    assertEqual(properties.smartGraphAttribute, 'value', `590: smartGraphAttribute of '${collName}'`);
    assertEqual(properties.numberOfShards, 1, `590: numberOfShards of '${collName}'`);
    assertEqual(properties.replicationFactor, replicationFactor, `590: replicationFactor of '${collName}'`);
    if (isCluster) {
      assertEqual(properties.shardingStrategy, 'hash', `590: shardingStrategy of '${collName}'`);
    }
  }

  function checkSatelliteCollection(collName, isCluster) {
    const properties = getCollection(collName).properties();
    assertFalse(properties.isSmart, `590: '${collName}' should not be smart`);
    assertFalse(properties.isDisjoint, `590: '${collName}' should not be disjoint`);
    assertEqual(properties.smartGraphAttribute, undefined, `590: '${collName}' should not have a smartGraphAttribute`);
    assertEqual(properties.numberOfShards, 1, `590: numberOfShards of '${collName}'`);
    assertEqual(properties.replicationFactor, 'satellite', `590: replicationFactor of '${collName}'`);
    if (isCluster) {
      assertEqual(properties.shardingStrategy, 'hash', `590: shardingStrategy of '${collName}'`);
    }
  }

  return {
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      let ver = semver.parse(oldVersion.split('-')[0]);
      return enterprise && semver.gt(ver, "3.12.10");
    },

    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} 590: making per database data ${dbCount}`);
      const sgm = require('@arangodb/smart-graph');
      const replicationFactor = getReplicationFactor(2);

      const h = hybridNames(dbCount);
      createSafe(h.graphName, gn => {
        return sgm._create(gn,
                           [sgm._relation(h.edges, h.verticesSat, h.verticesNonSat)],
                           [h.orphans],
                           {
                             satellites: [h.verticesSat],
                             smartGraphAttribute: 'value',
                             replicationFactor: replicationFactor
                           });
      }, gn => {
        return sgm._graph(gn);
      });
      progress(`590: created hybrid smart graph ${h.graphName}`);

      if (getCollection(h.verticesSat).count() === 0) {
        const docsSat = fillVertices(h.verticesSat);
        const docsNonSat = fillVertices(h.verticesNonSat);
        let eDocs = [];
        for (let i = 0; i < size; ++i) {
          eDocs.push({ _from: docsSat.saved[i], _to: docsNonSat.saved[i], value: String(i) });
          eDocs.push({ _from: docsSat.saved[i], _to: docsNonSat.saved[(i + 1) % size], value: String(i) });
        }
        getCollection(h.edges).insert(eDocs);
        getCollection(h.orphans).insert(docsSat.vDocs);
        getCollection(h.orphans).insert(docsNonSat.vDocs);
      }
      progress(`590: filled hybrid smart graph ${h.graphName}`);

      const d = disjointNames(dbCount);
      createSafe(d.graphName, gn => {
        return sgm._create(gn,
                           [sgm._relation(d.edgesSatA, d.verticesSat, d.verticesANonSat),
                            sgm._relation(d.edgesAB, d.verticesANonSat, d.verticesBNonSat)],
                           [d.orphans],
                           {
                             satellites: [d.verticesSat],
                             isDisjoint: true,
                             smartGraphAttribute: 'value',
                             replicationFactor: replicationFactor
                           });
      }, gn => {
        return sgm._graph(gn);
      });
      progress(`590: created hybrid disjoint smart graph ${d.graphName}`);

      if (getCollection(d.verticesSat).count() === 0) {
        const docsSat = fillVertices(d.verticesSat);
        const docsANonSat = fillVertices(d.verticesANonSat);
        const docsBNonSat = fillVertices(d.verticesBNonSat);

        let eDocs = [];
        for (let i = 0; i < size; ++i) {
          eDocs.push({ _from: docsSat.saved[i], _to: docsANonSat.saved[i], value: String(i) });
          eDocs.push({ _from: docsSat.saved[i], _to: docsANonSat.saved[(i + 1) % size], value: String(i) });
        }
        getCollection(d.edgesSatA).insert(eDocs);

        eDocs = [];
        for (let i = 0; i < size; ++i) {
          eDocs.push({ _from: docsANonSat.saved[i], _to: docsANonSat.saved[i], value: String(i) });
          eDocs.push({ _from: docsBNonSat.saved[i], _to: docsBNonSat.saved[i], value: String(i) });
        }
        getCollection(d.edgesAB).insert(eDocs);

        getCollection(d.orphans).insert(docsSat.vDocs);
        getCollection(d.orphans).insert(docsANonSat.vDocs);
      }
      progress(`590: filled hybrid disjoint smart graph ${d.graphName}`);
      return 0;
    },

    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      print(`${Date()} 590: checking per database data ${dbCount}`);
      const replicationFactor = getReplicationFactor(2);
      const graphsColl = db._collection('_graphs');
      const cmp = (a, b) => (a.collection < b.collection) ? -1 : ((a.collection === b.collection) ? 0 : 1);

      const h = hybridNames(dbCount);
      if (!graphsColl.exists(h.graphName)) {
        throw new Error(`590: graph '${h.graphName}' does not exist!`);
      }
      const hybrid = graphsColl.document(h.graphName);
      assertTrue(hybrid.isSmart, `590: '${h.graphName}' should be smart`);
      assertFalse(hybrid.isSatellite, `590: '${h.graphName}' should not be satellite`);
      assertEqual(hybrid.replicationFactor, replicationFactor, `590: replicationFactor of '${h.graphName}'`);
      assertEqual(hybrid.numberOfShards, 1, `590: numberOfShards of '${h.graphName}'`);
      assertEqual(hybrid.smartGraphAttribute, 'value', `590: smartGraphAttribute of '${h.graphName}'`);
      assertEqual(hybrid.edgeDefinitions, [
        { collection: h.edges, from: [h.verticesSat], to: [h.verticesNonSat] }
      ], `590: edge definitions of '${h.graphName}'`);
      assertEqual(hybrid.orphanCollections, [h.orphans], `590: orphan collections of '${h.graphName}'`);

      [h.verticesNonSat, h.orphans].forEach(name => checkSmartCollection(name, false, isCluster, replicationFactor));
      checkSatelliteCollection(h.verticesSat, isCluster);
      const hybridEdgeProperties = getCollection(h.edges).properties();
      assertFalse(hybridEdgeProperties.isSmart, `590: '${h.edges}' should not be smart`);
      assertFalse(hybridEdgeProperties.isDisjoint, `590: '${h.edges}' should not be disjoint`);
      assertEqual(hybridEdgeProperties.numberOfShards, 1, `590: numberOfShards of '${h.edges}'`);
      assertEqual(hybridEdgeProperties.replicationFactor, 'satellite', `590: replicationFactor of '${h.edges}'`);
      if (isCluster) {
        assertEqual(hybridEdgeProperties.shardingStrategy, 'hash', `590: shardingStrategy of '${h.edges}'`);
      }

      assertEqual(getCollection(h.edges).count(), 2 * size, `590: document count of '${h.edges}'`);
      assertEqual(getCollection(h.verticesSat).count(), size, `590: document count of '${h.verticesSat}'`);
      assertEqual(getCollection(h.verticesNonSat).count(), size, `590: document count of '${h.verticesNonSat}'`);
      assertEqual(getCollection(h.orphans).count(), 2 * size, `590: document count of '${h.orphans}'`);
      getCollection(h.edges).toArray().forEach(edge => {
        assertTrue(!!edge._from, `590: edge without _from in '${h.edges}'`);
        assertTrue(!!edge._to, `590: edge without _to in '${h.edges}'`);
      });
      progress(`590: checked hybrid smart graph ${h.graphName}`);

      const d = disjointNames(dbCount);
      if (!graphsColl.exists(d.graphName)) {
        throw new Error(`590: graph '${d.graphName}' does not exist!`);
      }
      const disjoint = graphsColl.document(d.graphName);
      assertTrue(disjoint.isSmart, `590: '${d.graphName}' should be smart`);
      assertFalse(disjoint.isSatellite, `590: '${d.graphName}' should not be satellite`);
      assertEqual(disjoint.replicationFactor, replicationFactor, `590: replicationFactor of '${d.graphName}'`);
      assertEqual(disjoint.numberOfShards, 1, `590: numberOfShards of '${d.graphName}'`);
      assertEqual(disjoint.smartGraphAttribute, 'value', `590: smartGraphAttribute of '${d.graphName}'`);
      assertEqual(disjoint.edgeDefinitions.slice().sort(cmp), [
        { collection: d.edgesSatA, from: [d.verticesSat], to: [d.verticesANonSat] },
        { collection: d.edgesAB, from: [d.verticesANonSat], to: [d.verticesBNonSat] }
      ].sort(cmp), `590: edge definitions of '${d.graphName}'`);
      assertEqual(disjoint.orphanCollections, [d.orphans], `590: orphan collections of '${d.graphName}'`);

      [d.verticesANonSat, d.verticesBNonSat, d.orphans].forEach(
        name => checkSmartCollection(name, true, isCluster, replicationFactor));
      checkSatelliteCollection(d.verticesSat, isCluster);
      [d.edgesSatA, d.edgesAB].forEach(name => {
        const properties = getCollection(name).properties();
        assertTrue(properties.isSmart, `590: '${name}' should be smart`);
        assertTrue(properties.isDisjoint, `590: '${name}' should be disjoint`);
        assertEqual(properties.replicationFactor, replicationFactor, `590: replicationFactor of '${name}'`);
        if (isCluster) {
          assertEqual(properties.numberOfShards, 0, `590: numberOfShards of '${name}'`);
          assertEqual(properties.shardingStrategy, 'enterprise-hash-smart-edge', `590: shardingStrategy of '${name}'`);
        } else {
          assertEqual(properties.numberOfShards, 1, `590: numberOfShards of '${name}'`);
        }
      });

      assertEqual(getCollection(d.edgesSatA).count(), 2 * size, `590: document count of '${d.edgesSatA}'`);
      assertEqual(getCollection(d.edgesAB).count(), 2 * size, `590: document count of '${d.edgesAB}'`);
      assertEqual(getCollection(d.verticesSat).count(), size, `590: document count of '${d.verticesSat}'`);
      assertEqual(getCollection(d.verticesANonSat).count(), size, `590: document count of '${d.verticesANonSat}'`);
      assertEqual(getCollection(d.verticesBNonSat).count(), size, `590: document count of '${d.verticesBNonSat}'`);
      assertEqual(getCollection(d.orphans).count(), 2 * size, `590: document count of '${d.orphans}'`);
      getCollection(d.edgesSatA).toArray().concat(getCollection(d.edgesAB).toArray()).forEach(edge => {
        assertTrue(!!edge._from, `590: edge without _from in the edges of '${d.graphName}'`);
        assertTrue(!!edge._to, `590: edge without _to in the edges of '${d.graphName}'`);
      });
      progress(`590: checked hybrid disjoint smart graph ${d.graphName}`);
      return 0;
    },

    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} 590: clearing per database data ${dbCount}`);
      const sgm = require('@arangodb/smart-graph');

      [hybridNames(dbCount).graphName, disjointNames(dbCount).graphName].forEach(graphName => {
        try {
          sgm._drop(graphName, true);
          progress(`590: dropped graph ${graphName}`);
        } catch (e) { }
      });
      return 0;
    }
  };
}());
