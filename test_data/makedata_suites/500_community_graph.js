/* global fs, PWD, writeGraphData, getShardCount,getReplicationFactor,  print, progress, db, createSafe, _  */

(function () {
  const g = require('@arangodb/general-graph');
  let vertices = JSON.parse(fs.readFileSync(`${PWD}/makedata_suites/500_550_570_vertices.json`));
  let edges = JSON.parse(fs.readFileSync(`${PWD}/makedata_suites/500_edges_naive.json`));
  return {
    isSupported: function (version, oldVersion, options, enterprise, cluster) {
      return true;
    },
    makeData: function (options, isCluster, isEnterprise, dbCount, loopCount) {
      // All items created must contain dbCount and loopCount
      print(`500: making data ${dbCount} ${loopCount}`);
      createSafe(`G_naive_${loopCount}`, graphName => {
        return g._create(graphName,
                         [
                           g._relation(`citations_naive_${loopCount}`,
                                       [`patents_naive_${loopCount}`],
                                       [`patents_naive_${loopCount}`])
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
      writeGraphData(db._collection(`patents_naive_${loopCount}`),
                     db._collection(`citations_naive_${loopCount}`),
                     _.clone(vertices), _.clone(edges));
      progress('loadGraph1');
    },
    checkData: function (options, isCluster, isEnterprise, dbCount, loopCount, readOnly) {
      progress("500: Checking patents naive");
      let patentsNaive = db._collection(`patents_naive_${loopCount}`);
      if (patentsNaive.count() !== 761) {
        throw new Error("500: patents naive count failed: want 761 have " + patentsNaive.count());
      }
      progress("500: Creating citations");
      let citationsNaive = db._collection(`citations_naive_${loopCount}`);
      if (citationsNaive.count() !== 1000) {
        throw new Error("500: Citations naive count incomplete: want 1000 have: " + citationsNaive.count());
      }
      progress("500: testing graph query");
      if (db._query(`FOR v, e, p IN 1..10 OUTBOUND "${patentsNaive.name()}/US:3858245${loopCount}"
                 GRAPH "G_naive_${loopCount}"
                 RETURN v`).toArray().length !== 6) {
        throw new Error("Physalis");
      }
      progress("500: ");
      if (db._query(`FOR p IN ANY K_SHORTEST_PATHS "${patentsNaive.name()}/US:60095410" TO "${patentsNaive.name()}/US:49997870"
                 GRAPH "G_naive_${loopCount}"
                 LIMIT 100
                 RETURN p`).toArray().length !== 2) {
        throw new Error("Dragonfruit");
      }
      progress("500: done");
    },
    clearData: function (options, isCluster, isEnterprise, dbCount, loopCount, readOnly) {
      print(`500: clearing data ${dbCount} ${loopCount}`);
      progress("500: dropping graph");
      try {
        g._drop(`G_naive_${loopCount}`, true);
      } catch (e) { }
    }
  };
}());
