/* global fs, PWD, writeGraphData, getShardCount, getReplicationFactor,  print, progress, db, createSafe, _, semver */

(function () {
  let gsm;
  let vertices = JSON.parse(fs.readFileSync(`${PWD}/makedata_suites/500_550_570_vertices.json`));
  let smartEdges = JSON.parse(fs.readFileSync(`${PWD}/makedata_suites/550_570_edges.json`));

  return {
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      if (enterprise) {
        gsm = require('@arangodb/smart-graph');
      }
      // strip off -nightly etc:
      let ver = semver.parse(oldVersion.split('-')[0]);
      // as of 3.10 BTS-776 has to have this workaround:
      return enterprise && (cluster || semver.lt(ver, "3.10.0"));
    },
    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      // All items created must contain dbCount and dbCount
      progress(`550: making data ${dbCount} ${dbCount}`);
      // And now a smart graph (if enterprise):
      createSafe(`G_smart_${dbCount}`, graphName => {
        return gsm._create(graphName,
                           [
                             gsm._relation(`citations_smart_${dbCount}`,
                                           [`patents_smart_${dbCount}`],
                                           [`patents_smart_${dbCount}`])],
                           [],
                           {
                             numberOfShards: getShardCount(3),
                             replicationFactor: getReplicationFactor(2),
                             smartGraphAttribute: "COUNTRY"
                           });
      }, graphName => {
        return gsm._graph(graphName);
      });
      progress('550: createEGraph2');
      writeGraphData(db._collection(`patents_smart_${dbCount}`),
                     db._collection(`citations_smart_${dbCount}`),
                     _.clone(vertices),
                     _.clone(smartEdges));
      progress('550: writeEGraph2 done');
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      progress(`550: checking data ${dbCount} ${dbCount}`);
      const vColName = `patents_smart_${dbCount}`;
      let expectNoDocs = options.dataMultiplier * 761;
      let patentsSmart = db._collection(vColName);
      progress(`550: checking ${vColName} collection count`);
      if (patentsSmart.count() !== expectNoDocs) {
        throw new Error(`550: patents smart count failed: want ${expectNoDocs} but have ${patentsSmart.count()}`);
      }
      const eColName = `citations_smart_${dbCount}`;
      progress(`550: checking ${eColName} collection count`);
      let expectNoEdges = options.dataMultiplier * 1000;
      let citationsSmart = db._collection(eColName);
      if (citationsSmart.count() !== expectNoEdges) {
        throw new Error(`550: Citations smart count incomplete: want ${expectNoEdges} have: ${citationsSmart.count()}`);
      }
      let docIds = ['US:38582450', 'US:60095410', 'US:49997870'];
      let count = 0;
      if (options.dataMultiplier !== 1 || options.numberOfDBs !== 1 ) {
        [0, 1, 2].forEach(i => {
          let doc = {};
          do {
            try {
              doc = patentsSmart.document(docIds[i]);
            } catch (ex) {
              docIds[i] = docIds[i] + '0';
            }
            count += 1;
            if (count > 100) {
              throw new Error(`failed to locate ${docIds[i]}`);
            }
          } while (!doc.hasOwnProperty('_key'));
        });
      }
      const gName = `G_smart_${dbCount}`;
      progress(`550: checking query on ${gName}`);
      let query = `FOR v, e, p IN 1..10 OUTBOUND "${patentsSmart.name()}/${docIds[0]}"
                   GRAPH "${gName}"
                   RETURN v`;
      let result = db._query(query).toArray();
      if (result.length !== 6) {
        throw new Error(`550: ${query} expected 6 results, but got ${result.length} - ${JSON.stringify(result)}`);
      }
      progress("550: ");
      query = `FOR p IN ANY K_SHORTEST_PATHS "${patentsSmart.name()}/${docIds[1]}" TO "${patentsSmart.name()}/${docIds[2]}"
                 GRAPH "${gName}"
                 LIMIT 100
                 RETURN p`;
      result = db._query(query).toArray();
      if (result.length !== 2) {
        throw new Error(`550: ${query} expected 2 results, but got ${result.length} - ${JSON.stringify(result)}`);
      }
      progress('550: done');
    },
    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      progress(`550: clearing data ${dbCount} ${dbCount}`);
    // Drop graph:
      let gsm = require("@arangodb/smart-graph");
      progress('550 dropping smart graph');
      try {
        gsm._drop(`G_smart_${dbCount}`, true);
      } catch (e) { }
    }
  };
}());
