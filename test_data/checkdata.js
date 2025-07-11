/* global print, ARGUMENTS, arango */
//
// Use like this:
//   arangosh USUAL_OPTIONS_INCLUDING_AUTHENTICATION --javascript.execute cleardata.js [DATABASENAME]
// where DATABASENAME is optional and defaults to "_system". The database
// in question is created (if it is not "_system").
// `--minReplicationFactor [1]  don't create collections with smaller replication factor than this.
// `--maxReplicationFactor [2]  don't create collections with a bigger replication factor than this.
// `--dataMultiplier [1]        0 - no data; else n-times the data
// `--numberOfDBs [1]           count of databases to create and fill
// `--countOffset [0]           number offset at which to start the database count
// `--bigDoc false              attach a big string to the edge documents
// `--collectionMultiplier [1]  how many times to create the collections / index / view / graph set?
// `--collectionCountOffset [0] number offset at which to start the database count
// `--singleShard [false]       whether this should only be a single shard instance
// `--progress [false]          whether to output a keepalive indicator to signal the invoker that work is ongoing
// `--disabledDbserverUUID      this server is offline, wait for shards on it to be moved
// `--readonly                  the SUT is readonly. fail if writing is successfull.
// `--test                      comma separated list of testcases to filter for
// `--skip                              comma separated list of testcases to filter out
'use strict';
const fs = require('fs');
const _ = require('lodash');
const internal = require('internal');
const semver = require('semver');
const arangodb = require("@arangodb");
const console = require("console");
const db = internal.db;
const time = internal.time;
const sleep = internal.sleep;
const ERRORS = arangodb.errors;
let v = db._version(true);
let enterprise = v.license === "enterprise";
const dbVersion = db._version();

let PWDRE = /.*at (.*)checkdata.js.*/;
let stack = new Error().stack;
let PWD = fs.makeAbsolute(PWDRE.exec(stack)[1]);
let isCluster = arango.GET("/_admin/server/role").role === "COORDINATOR";
let database = "_system";
let databaseName;

const wantFunctions = ['checkDataDB', 'checkData'];

let {
  options,
  setOptions,
  runAqlQueryResultCount,
  runAqlQueryResultCountMultiply,
  scanMakeDataPaths,
  mainTestLoop
} = require(fs.join(PWD, 'common'));

const {
  assertTrue,
  assertFalse,
  assertEqual
} = require("jsunity").jsUnity.assertions;

const {
  createAnalyzerSet,
  checkAnalyzerSet,
  deleteAnalyzerSet
} = require(fs.join(PWD, 'makedata_suites', '_600_analyzer_base'));

const optionsDefaults = {
  curVersion: dbVersion,
  disabledDbserverUUID: "",
  minReplicationFactor: 1,
  maxReplicationFactor: 2,
  readOnly: false,
  bigDoc: false,
  numberOfDBs: 1,
  mixed: false,
  countOffset: 0,
  dataMultiplier: 1,
  collectionMultiplier: 1,
  collectionCountOffset: 0,
  testFoxx: true,
  singleShard: false,
  progress: false,
  oldVersion: "3.5.0",
  test: undefined,
  skip: undefined,
  passvoid: '',
  printTimeMeasurement: false,
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
if (opts.collectionCountOffset !== 0 && database === '_system') {
  throw new Error("must not specify count without different database.");
}

if (opts.mixed) {
  print("Disabling enterprise in mixed environment");
  enterprise = false;
}

var numberLength = Math.log(opts.numberOfDBs + opts.countOffset) * Math.LOG10E + 1 | 0;

const zeroPad = (num) => String(num).padStart(numberLength, '0');

let tStart = 0;
let timeLine = [];
function progress (gaugeName) {
  if (gaugeName === undefined) {
    throw new Error("gauge name must be defined");
  }
  let now = time();
  let delta = now - tStart;
  timeLine.push(delta);
  if (opts.progress) {
    if (opts.printTimeMeasurement) {
      print(`# - ${gaugeName},${tStart},${delta}`);
    } else {
      print(`# - ${gaugeName}`);
    }
  }
  tStart = now;
}

function getShardCount (defaultShardCount) {
  if (opts.singleShard) {
    return 1;
  }
  return defaultShardCount;
}

function getReplicationFactor (defaultReplicationFactor) {
  if (defaultReplicationFactor > opts.maxReplicationFactor) {
    return opts.maxReplicationFactor;
  }
  if (defaultReplicationFactor < opts.minReplicationFactor) {
    return opts.minReplicationFactor;
  }
  return defaultReplicationFactor;
}

const fns = scanMakeDataPaths(opts, PWD, dbVersion, opts.oldVersion, wantFunctions, 'checkData', false);
mainTestLoop(opts, database, isCluster, enterprise, fns, function(database) {
  if (opts.printTimeMeasurement) {
    opts.error(timeLine.join());
  }
});
