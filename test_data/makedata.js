/* global print, ARGUMENTS, arango */
//
// Use like this:
//   arangosh USUAL_OPTIONS_INCLUDING_AUTHENTICATION --javascript.execute makedata.js [DATABASENAME]
// where DATABASENAME is optional and defaults to "_system". The database
// in question is created (if it is not "_system").
// `--minReplicationFactor [1]             don't create collections with smaller replication factor than this.
// `--maxReplicationFactor [2]             don't create collections with a bigger replication factor than this.
// `--dataMultiplier [1]                   0 - no data; else n-times the data
// `--numberOfDBs [1]                      count of databases to create and fill
// `--countOffset [0]                      number offset at which to start the database count
// `--bigDoc false                         attach a big string to the edge documents
// `--collectionMultiplier [1]             how many times to create the collections / index / view / graph set?
// `--collectionCountOffset [0]            number offset at which to start the database count
// `--singleShard [false]                  whether this should only be a single shard instance
// `--progress [false]                     whether to output a keepalive indicator to signal the invoker that work is ongoing
// `--bigDoc                               Increase size of the graph documents
// `--test                                 comma separated list of testcases to filter for
// `--tempDataDir                          directory to store temporary data
// `--excludePreviouslyExecutedTests       If enabled, information about which tests were ran will be saved in the temporary directory. These tests will be skipped during next run. Default: false.
'use strict';
const fs = require('fs');
const _ = require('lodash');
const internal = require('internal');
const semver = require('semver');
const arangodb = require("@arangodb");
const db = internal.db;
const time = internal.time;
const sleep = internal.sleep;
const ERRORS = arangodb.errors;
let v = db._version(true);
const enterprise = v.license === "enterprise";
const dbVersion = db._version();

let PWDRE = /.*at (.*)makedata.js.*/;
let stack = new Error().stack;
let PWD = fs.makeAbsolute(PWDRE.exec(stack)[1]);
let isCluster = arango.GET("/_admin/server/role").role === "COORDINATOR";
let database = "_system";
const wantFunctions = ['makeDataDB', 'makeData'];

let {
  options,
  setOptions,
  scanMakeDataPaths,
  mainTestLoop,
  createSafe,
  progress,
  getShardCount,
  getReplicationFactor,
  writeGraphData,
  createUseDatabaseSafe,
  createCollectionSafe,
  createIndexSafe,
  runAqlQueryResultCount,
  makeRandomString,
  makeRandomNumber,
  makeRandomTimeStamp,
  makeRandomDoc,
  writeData,
  resetRCount,
} = require(fs.join(PWD, 'common'));

const {
  createAnalyzerSet,
  checkAnalyzerSet,
  deleteAnalyzerSet
} = require(fs.join(PWD, 'makedata_suites', '_600_analyzer_base'));

const optionsDefaults = {
  curVersion: dbVersion,
  minReplicationFactor: 1,
  maxReplicationFactor: 2,
  numberOfDBs: 1,
  countOffset: 0,
  dataMultiplier: 1,
  collectionMultiplier: 1,
  collectionCountOffset: 0,
  testFoxx: true,
  singleShard: false,
  progress: false,
  newVersion: "3.5.0",
  passvoid: '',
  printTimeMeasurement: false,
  bigDoc: false,
  test: undefined,
  tempDataDir: "/tmp/makedata",
  excludePreviouslyExecutedTests: false,
  forceOneShard: false
};

let args = _.clone(ARGUMENTS);
if ((args.length > 0) &&
    (args[0].slice(0, 1) !== '-')) {
  database = args[0]; // must start with 'system_' else replication fuzzing may delete it!
  args = args.slice(1);
}

let opts = internal.parseArgv(args, 0);
_.defaults(opts, optionsDefaults);
setOptions(opts);
if (options.collectionCountOffset !== 0 && database === '_system') {
  throw new Error("must not specify count without different database.");
}
var numberLength = Math.log(opts.numberOfDBs + opts.countOffset) * Math.LOG10E + 1 | 0;

const zeroPad = (num) => String(num).padStart(numberLength, '0');

const fns = scanMakeDataPaths(opts, PWD, dbVersion, dbVersion, wantFunctions, 'makeData', opts.excludePreviouslyExecutedTests);
mainTestLoop(opts, database, isCluster, enterprise, fns, function(database) {
  try {
    db._useDatabase("_system");
    db._create('_fishbowl', {
      isSystem: true,
      distributeShardsLike: '_users'
    });
  } catch (err) {}
});
