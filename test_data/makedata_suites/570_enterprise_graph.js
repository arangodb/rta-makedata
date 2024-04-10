/* global fs, PWD, writeGraphData, getShardCount, getReplicationFactor,  print, progress, db, createSafe, _, semver,  createUseDatabaseSafe*/

(function () {
  let egm;
  let vertices = JSON.parse(fs.readFileSync(`${PWD}/makedata_suites/500_550_570_vertices.json`));
  let smartEdges = JSON.parse(fs.readFileSync(`${PWD}/makedata_suites/550_570_edges.json`));

  return {
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      // strip off -nightly etc:
      let ver = semver.parse(oldVersion.split('-')[0]);
      // TODO: mitigate (to (a) fixed version(s)) "&& !options.singleShard" after BTS-1841 is fixed
      return enterprise && (semver.gte(ver, "3.10.0")) && !options.singleShard;
    },
    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      egm = require('@arangodb/enterprise-graph');
      // All items created must contain dbCount
      print(`570: making per database data ${dbCount}`);
      let baseName = database;
      if (baseName === "_system") {
        baseName = "system";
      }
      const databaseName = `${baseName}_${dbCount}_entGraph`;
      const created = createUseDatabaseSafe(databaseName, {});
      progress(`created database '${databaseName}'`);
      createSafe(`G_enterprise_${dbCount}`, graphName => {
        return egm._create(graphName,
                           [
                             {
                                 "collection": `citations_enterprise_${dbCount}`,
                                 "to": [`patents_enterprise_${dbCount}`],
                                 "from": [`patents_enterprise_${dbCount}`]
                              }
                           ],
                           [],
                           {
                             numberOfShards: getShardCount(3),
                             replicationFactor: getReplicationFactor(2),
                             isSmart: true
                           });
      }, graphName => {
        return egm._graph(graphName);
      });
      progress('createEGraph2');
      writeGraphData(db._collection(`patents_enterprise_${dbCount}`),
                     db._collection(`citations_enterprise_${dbCount}`),
                     _.clone(vertices),
                     _.clone(smartEdges));
      progress('writeEGraph2');
      return 0;
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      print(`570: checking data in database ${database} dbCount: ${dbCount}`);
      let baseName = database;
      if (baseName === "_system") {
        baseName = "system";
      }
      let expectNoDocs = options.dataMultiplier * 761;
      const databaseName = `${baseName}_${dbCount}_entGraph`;
      db._useDatabase(databaseName);
      const vColName = `patents_enterprise_${dbCount}`;
      let colNames = db._collections();
      if (colNames.find(cn => cn.name() === vColName) === undefined) {
        throw new Error(vColName + " doesn't exist!");
      }
      let patentsSmart = db._collection(vColName);
      if (patentsSmart.count() !== expectNoDocs) {
        throw new Error(`570: patents smart count failed: want ${expectNoDocs} but have ${patentsSmart.count()}`);
      }
      progress("570: count patents");
      let expectNoEdges = options.dataMultiplier * 1000;
      const eColName = `citations_enterprise_${dbCount}`;
      if (colNames.find(cn => cn.name() === eColName) === undefined) {
        throw new Error(eColName + " doesn't exist!");
      }
      let citationsSmart = db._collection(eColName);
      if (citationsSmart.count() !== expectNoEdges) {
        throw new Error(`570: ${eColName} Citations smart count incomplete: want ${expectNoEdges} have: ${citationsSmart.count()}`);
      }
      let docIds = ['US:38582450', 'IL:60095520', 'US:60095410', 'US:49997870'];
      if (options.dataMultiplier !== 1 || options.numberOfDBs !== 1 ) {
        [0, 1, 2, 3].forEach(i => {
          let doc = {};
          do {
            try {
              doc = patentsSmart.document(docIds[i]);
            } catch (ex) {
              docIds[i] = docIds[i] + '0';
            }
          } while (!doc.hasOwnProperty('_key'));
        });
      }
      if (options.dataMultiplier !== 1) {
        progress("570: skipping graph query");
        return 0;
      }
      {
        progress("570: smart traversal named graph start");
        //traverse enterprise graph
        const gName = `G_enterprise_${dbCount}`;
        let query = `FOR v, e, p IN 1..10 OUTBOUND "${patentsSmart.name()}/${docIds[0]}"
                       GRAPH "${gName}"
                       RETURN v`;
        progress(`570: running query: ${query}\n`);
        let len = db._query(query).toArray().length;
        if (len !== 6) {
          throw new Error("Black Currant 6 != " + len);
        }
      }
      progress("570: smart traversal done anonymous Graph starts");
      {
        //use enterprise graph's edge collection as an anonymous graph
        let query = `
                    WITH ${patentsSmart.name()}
                    FOR v, e, p IN 1..10 OUTBOUND "${patentsSmart.name()}/${docIds[1]}"
                    ${citationsSmart.name()}
                    RETURN v
                    `;
        progress(`570: running query: ${query}\n`);
        let ret = db._query(query).toArray();
        if (ret.length !== 5) {
          throw new Error(`Graph query ${query} failed: 5 != ${ret.length} ${JSON.stringify(ret)}`);
        }
      }
      progress("570: ");
      {
        //check K_SHORTEST_PATHS query on an enterprise graph
        const gName = `G_enterprise_${dbCount}`;
        let query = `
                 FOR p IN ANY K_SHORTEST_PATHS "${patentsSmart.name()}/${docIds[2]}" TO "${patentsSmart.name()}/${docIds[3]}"
                 GRAPH "${gName}"
                 LIMIT 100
                 RETURN p
                    `;
        progress(`running query: ${query}\n`);
        let ret = db._query(query).toArray();
        if (ret.length !== 2) {
          throw new Error(`Graph query ${query} failed: 2 != ${ret.length} ${JSON.stringify(ret)}`);
        }
      }
      progress("570: done");
      return 0;
    },
    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`570: Clearing data. Database: ${database}. DBCount: ${dbCount}`);
      let baseName = database;
      if (baseName === "_system") {
        baseName = "system";
      }
      const databaseName = `${baseName}_${dbCount}_entGraph`;
      db._useDatabase(databaseName);
      // Drop graph:
      let egm = require("@arangodb/enterprise-graph");
      try {
        egm._drop(`G_enterprise_${dbCount}`, true);
        db._useDatabase('_system');
        db._dropDatabase(databaseName);
      } catch (e) { }
      return 0;
    }
  };
}());
