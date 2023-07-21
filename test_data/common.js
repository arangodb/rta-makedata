/* global print, ARGUMENTS, */
// these come from makedata.js / checkdata.js / cleardata.js:
/* global _, fs, enterprise, db, database, isCluster, progress, time */
// these are our state variables, we need to write them:
/* global tStart:true, timeLine:true */
//
const internal = require('internal');
const AsciiTable = require('ascii-table');
const arangodb = require("@arangodb");
const sleep = internal.sleep;
const ERRORS = arangodb.errors;

function isCharDigit(n){
  return !!n.trim() && n > -1;
}
let options = {};
let tStart = 0;
let timeLine = [];

function progress (gaugeName) {
  if (gaugeName === undefined) {
    throw new Error("gauge name must be defined");
  }
  let now = time();
  let delta = now - tStart;
  timeLine.push(delta);
  if (options.progress) {
    if (options.printTimeMeasurement) {
      print(`# - ${gaugeName},${tStart},${delta}`);
    } else {
      print(`# - ${gaugeName}`);
    }
  }
  tStart = now;
}

function getShardCount (defaultShardCount) {
  if (options.singleShard) {
    return 1;
  }
  return defaultShardCount;
}

function getReplicationFactor (defaultReplicationFactor) {
  if (defaultReplicationFactor > options.maxReplicationFactor) {
    return options.maxReplicationFactor;
  }
  if (defaultReplicationFactor < options.minReplicationFactor) {
    return options.minReplicationFactor;
  }
  return defaultReplicationFactor;
}

let bigDoc = '';
function writeGraphData (V, E, vertices, edges) {
  if (options.bigDoc && bigDoc === '') {
    for (let i = 0; i < 100000; i++) {
      bigDoc += "abcde" + i;
    }
  }
  let gcount = 0;

  while (gcount < options.dataMultiplier) {
    edges.forEach(edg => {
      edg._from = V.name() + '/' + edg._from.split('/')[1] + "" + gcount;
      edg._to = V.name() + '/' + edg._to.split('/')[1] + "" + gcount;
      if (options.bigDoc) {
        edg.bigDoc = bigDoc;
      }
    });
    let cVertices = _.clone(vertices);
    cVertices.forEach(vertex => {
      vertex['_key'] = vertex['_key'] + gcount;
    });
    V.insert(vertices);
    E.insert(edges);
    gcount += 1;
  }
}

function createSafe (name, fn1, fnErrorExists) {
  let countDbRetry = 0;
  while (countDbRetry < 50) {
    try {
      return fn1(name);
    } catch (x) {
      if (x.errorNum === ERRORS.ERROR_ARANGO_DUPLICATE_NAME.code) {
        console.error(`${db._name()}: ${name}: its already there? ${x.message} `);
        try {
          // make sure no local caches are there:
          db._flushCache();
          return fnErrorExists(name);
        } catch (x) {
          sleep(countDbRetry * 0.1);
          countDbRetry += 1;
          console.error(`${db._name()}: ${name}: isn't there anyways??? ${x.message} - ${x.stack}`);
        }
      } else {
        sleep(countDbRetry * 0.1);
        countDbRetry += 1;
        console.error(`${db._name()}: ${name}: ${x.message} - ${x.stack}`);
      }
    }
  }
  console.error(`${name}: finally giving up anyways.`);
  throw new Error(`${name} creation failed!`);
}

function createCollectionSafe (name, DefaultNumShards, DefaultReplFactor, otherOptions = {}) {
  let defaultOptions = {
    numberOfShards: getShardCount(DefaultNumShards),
    replicationFactor: getReplicationFactor(DefaultReplFactor)
  };
  let options = {...defaultOptions, ...otherOptions};
  return createSafe(name, colName => {
    return db._create(colName, options);
  }, colName => {
    return db._collection(colName);
  });
}

function createIndexSafe (options) {
  let opts = _.clone(options);
  delete opts.col;
  return createSafe(options.col.name(), colname => {
    options.col.ensureIndex(opts);
  }, colName => {
    return false; // well, its there?
  });
}


function scanMakeDataPaths (options, PWD, oldVersion, newVersion, wantFunctions, nameString) {
  let tableColumnHeaders = [
    "DB", "loop", "testname"
  ];
  let resultTable = new AsciiTable("");
  resultTable.setHeading(tableColumnHeaders);

  let fns = [[],[]];
  const FNChars = [ 'D', 'L'];
  let filters = [];
  if (options.hasOwnProperty('test') && (typeof (options.test) !== 'undefined')) {
    filters = options.test.split(',');
  }
  let testDir = fs.join(PWD, 'makedata_suites');
  let suites = _.filter(
    fs.list(testDir),
    function (p) {
      if (!isCharDigit(p.charAt(0))) {
        return false;
      }
      if (filters.length > 0) {
        let found = false;
        filters.forEach(flt => {
          if (p.search(flt) >= 0) {
            found = true;
          }
        });
        if (!found) {
          return false;
        }
      }
      return (p.substr(-3) === '.js');
    }).map(function (x) {
      return fs.join(fs.join(PWD, 'makedata_suites'), x);
    }).sort();
  suites.forEach(suitePath => {
    let column = [];
    let supported = "";
    let unsupported = "";
    let suite = require("internal").load(suitePath);
    if (suite.isSupported(oldVersion, newVersion, options, enterprise, isCluster)) {
      let count = 0;
      wantFunctions.forEach(fn => {
        if (wantFunctions[count] in suite) {
          column.push(' X');
          supported += FNChars[count];
          fns[count].push(suite[fn]);
        } else {
          column.push(' ');
          unsupported += " ";
        }
        count += 1;
      });
    } else {
      column.push(' ');
      column.push(' ');
      supported = " ";
      unsupported = " ";
    }
    let pseg = suitePath.split(fs.pathSeparator);
    column.push(pseg[pseg.length - 1]);
    resultTable.addRow(column);
  });
  print(resultTable.toString());
  print(` in ${testDir}`);
  return fns;
}

function mainTestLoop(options, isCluster, enterprise, fns, endOfLoopFN) {
  let dbCount = options.countOffset;
  let totalCount = options.countOffset + options.numberOfDBs;
  while (dbCount < totalCount) {
    tStart = time();
    timeLine = [tStart];
    fns[0].forEach(func => {
      db._useDatabase("_system");
      func(options,
           isCluster,
           enterprise,
           database,
           dbCount);
    });

    let loopCount = options.collectionCountOffset;
    while (loopCount < options.collectionMultiplier) {
      progress('inner Loop start');
      print(`inner Loop start ${loopCount} ${dbCount}`);
      fns[1].forEach(func => {
        func(options,
             isCluster,
             enterprise,
             dbCount,
             loopCount);
      });

      progress('inner Loop End');
      loopCount ++;
    }
    progress('outer loop end');

    endOfLoopFN(database);
    if (options.printTimeMeasurement) {
      print(timeLine.join());
    }
    dbCount++;
  }
}

function getMetricValue (text, name) {
  let re = new RegExp("^" + name);
  let matches = text.split('\n').filter((line) => !line.match(/^#/)).filter((line) => line.match(re));
  if (!matches.length) {
    throw "Metric " + name + " not found";
  }
  return Number(matches[0].replace(/^.*{.*}([0-9. ]+)$/, "$1"));
}

exports.scanMakeDataPaths = scanMakeDataPaths;
exports.mainTestLoop = mainTestLoop;
exports.getMetricValue = getMetricValue;
exports.createSafe = createSafe;
exports.progress = progress;
exports.getShardCount = getShardCount;
exports.getReplicationFactor = getReplicationFactor;
exports.writeGraphData = writeGraphData;
exports.createCollectionSafe = createCollectionSafe;
exports.createIndexSafe = createIndexSafe;
exports.setOptions = function (opts) { options = opts;};
Object.defineProperty(exports, 'options', { get: () => options });
