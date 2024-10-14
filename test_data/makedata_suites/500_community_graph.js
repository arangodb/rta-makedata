/* global fs, PWD, writeGraphData, getShardCount,getReplicationFactor,  print, progress, db, createSafe, _  */

(function () {
  const g = require('@arangodb/general-graph');
  let vertices = JSON.parse(fs.readFileSync(`${PWD}/makedata_suites/500_550_570_vertices.json`));
  let edges = JSON.parse(fs.readFileSync(`${PWD}/makedata_suites/500_edges_naive.json`));
  return {
    isSupported: function (version, oldVersion, options, enterprise, cluster) {
      return true;
    },
    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      // All items created must contain dbCount 
      progress(`500: making data ${dbCount}`);
      createSafe(`G_naive_${dbCount}`, graphName => {
        return g._create(graphName,
                         [
                           g._relation(`citations_naive_${dbCount}`,
                                       [`patents_naive_${dbCount}`],
                                       [`patents_naive_${dbCount}`])
                         ],
                         [],
                         {
                           replicationFactor: getReplicationFactor(2),
                           numberOfShards: getShardCount(3)
                         });

      }, graphName => {
        return g._graph(graphName);
      });
      progress('createGraph1');
      writeGraphData(db._collection(`patents_naive_${dbCount}`),
                     db._collection(`citations_naive_${dbCount}`),
                     _.clone(vertices), _.clone(edges));
      progress('loadGraph1');
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      progress("500: Checking patents naive");
      let expectNoDocs = options.dataMultiplier * 761;
      let patentsNaive = db._collection(`patents_naive_${dbCount}`);
      if (patentsNaive.count() !== expectNoDocs) {
        throw new Error(`500: patents naive count failed: want ${expectNoDocs} but have ${patentsNaive.count()}`);
      }
      progress("500: Checking citations");
      let docIds = ['US:38582450', 'US:60095410', 'US:49997870'];
      if (options.dataMultiplier !== 1 || options.numberOfDBs !== 1 ) {
        [0, 1, 2].forEach(i => {
          let doc = {};
          do {
            try {
              doc = patentsNaive.document(docIds[i]);
            } catch (ex) {
              docIds[i] = docIds[i] + '0';
            }
          } while (!doc.hasOwnProperty('_key'));
        });
      }
      let expectNoEdges = options.dataMultiplier * 1000;
      let citationsNaive = db._collection(`citations_naive_${dbCount}`);
      if (citationsNaive.count() !== expectNoEdges) {
        throw new Error(`500: Citations naive count incomplete: want ${expectNoEdges} have: ${citationsNaive.count()}`);
      }
      if (options.dataMultiplier !== 1) {
        progress("500: skipping graph query");
        return 0;
      }
      progress("500: testing graph query");
      let ret = db._query(`FOR v, e, p IN 1..10 OUTBOUND "${patentsNaive.name()}/${docIds[0]}"
                 GRAPH "G_naive_${dbCount}"
                 RETURN v`).toArray();
      if (ret.length !== 6) {
        throw new Error(`500: Query 'FOR v, e, p IN 1..10 OUTBOUND "${patentsNaive.name()}/${docIds[0]}' got ${ret.length} was expecting 6: ${JSON.stringify(ret)}`);
      }
      progress("500: ");
        ret = db._query(`FOR p IN ANY K_SHORTEST_PATHS "${patentsNaive.name()}/${docIds[1]}" TO "${patentsNaive.name()}/${docIds[2]}"
                 GRAPH "G_naive_${dbCount}"
                 LIMIT 100
                 RETURN p`).toArray();
      if (ret.length !== 2) {
        throw new Error(`500: Query 12 got ${ret.length} was expecting 2: ${JSON.stringify(ret)}`);
      }
      progress("500: done");
    },
    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      progress(`500: clearing data ${dbCount} ${dbCount}`);
      progress("500: dropping graph");
      try {
        g._drop(`G_naive_${dbCount}`, true);
      } catch (e) { }
    }
  };
}());
