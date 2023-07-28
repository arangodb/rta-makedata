/* global ARGUMENTS, print */
const fs = require('fs');

let egm = require('@arangodb/enterprise-graph');
let PWDRE = /.*at (.*)smart_graph.js.*/;
let stack = new Error().stack;
let PWD = fs.makeAbsolute(PWDRE.exec(stack)[1]);

let {
  options,
  setOptions,
  createSafe,
  progress,
  getShardCount,
  getReplicationFactor,
  writeGraphData } = require(fs.join(PWD, "..", "common"));

const _ = require('lodash');
const arangodb = require('@arangodb');
const db = arangodb.db;
const internal = require("internal");
const time = internal.time;
const sleep = internal.sleep;

let args = _.clone(ARGUMENTS);

let opts = internal.parseArgv(args, 0);

setOptions(opts);


const databaseName = `egdb_${opts.count}_entGraph`;
const created = createSafe(databaseName,
                           dbname => {
                             db._flushCache();
                             db._createDatabase(dbname);
                             db._useDatabase(dbname);
                             return true;
                           }, dbname => {
                             throw new Error("Creation of database ${databaseName} failed!");
                           }
                          );
progress(`created database '${databaseName}'`);
createSafe(`G_enterprise_${opts.count}`, graphName => {
  return egm._create(graphName,
                     [
                       {
                         "collection": `citations_enterprise_${opts.count}`,
                         "to": [`patents_enterprise_${opts.count}`],
                         "from": [`patents_enterprise_${opts.count}`]
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
sleep(10);
console.log('nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn');
let vertices = JSON.parse(fs.readFileSync(`${PWD}/../makedata_suites/500_550_570_vertices.json`));
let smartEdges = JSON.parse(fs.readFileSync(`${PWD}/../makedata_suites/550_570_edges.json`));

progress('createEGraph2');
let E = db._collection(`citations_enterprise_${opts.count}`);
let V = db._collection(`patents_enterprise_${opts.count}`);
writeGraphData(V,
               E,
               _.clone(vertices),
               _.clone(smartEdges));

let count = 0;
while (count < 100000) {
  smartEdges.forEach(edge => {
    let edg = _.clone(edge);
    edg._from = V.name() + '/' + edg._from.split('/')[1] + "" + count;
    edg._to = V.name() + '/' + edg._to.split('/')[1] + "" + count;
    E.insert(edg);
  });
  count += 1;
  print(`${opts.count} - ${count}.`);
}
print(`DONE! ${options.count}`);
