/* global print, ARGUMENTS, */
// these come from makedata.js / checkdata.js / cleardata.js:
/* global _, fs, enterprise, db, database, isCluster, progress, time, zeroPad */
// these are our state variables, we need to write them:
/* global tStart:true, timeLine:true */
//
const internal = require('internal');
const AsciiTable = require('ascii-table');
const arangodb = require("@arangodb");
const sleep = internal.sleep;
const ERRORS = arangodb.errors;
let rand = require("internal").rand;

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
    if (options.bigDoc) {
      print(".");
      let len = edges.length / 8;
      [0, 1, 2, 3, 4, 5, 6, 7].forEach(i => {
        E.insert(edges.slice(len*i, len * (i+1)));
      });
    } else {
      E.insert(edges);
    }
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

function createUseDatabaseSafe(databaseName, dbOptions) {
      return createSafe(databaseName,
                        dbname => {
                          db._useDatabase('_system');
                          db._flushCache();
                          db._createDatabase(dbname);
                          db._useDatabase(dbname);
                          return true;
                        }, dbname => {
                          throw new Error("Creation of database ${dbname} failed!");
                        }
                       );
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

function runAqlQueryResultCount(query, expectLength) {
  let res = db._query(query.query, query.bindVars).toArray();
  if (res.length !== expectLength) {
    throw new Error(`AQL query: '${query.query}' '${JSON.stringify(query.bindVars)}' expecting ${expectLength} but got ${res.length} - ${JSON.stringify(res)}`);
  }
}

function runAqlQueryResultCountMultiply(query, expectLength) {
  let res = db._query(query.query, query.bindVars).toArray();
  if (res.length !== expectLength * options.dataMultiplier) {
    throw new Error(`AQL query: '${query.query}' '${JSON.stringify(query.bindVars)}' expecting ${expectLength * options.dataMultiplier} but got ${res.length} - ${JSON.stringify(res)}`);
  }
}

function scanMakeDataPaths (options, PWD, oldVersion, newVersion, wantFunctions, nameString, excludePreviouslyExecuted) {
  var EXECUTED_TEST_SUITES_FILE = "";
  var previously_executed_suites = [];
  if(excludePreviouslyExecuted) {
    EXECUTED_TEST_SUITES_FILE = fs.join(options.tempDataDir, "executed_test_suites.json");
    if(!fs.exists(options.tempDataDir)){
      fs.makeDirectoryRecursive(options.tempDataDir);
    }
    
    try {
      previously_executed_suites = JSON.parse(fs.read(EXECUTED_TEST_SUITES_FILE));
    } catch (exception) { } 
  }

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
  let negFilters = [];
  if (options.hasOwnProperty('skip') && (typeof (options.skip) !== 'undefined')) {
    negFilters = options.skip.split(',');
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
      if (negFilters.length > 0) {
        let found = false;
        negFilters.forEach(flt => {
          if (p.search(flt) >= 0) {
            found = true;
          }
        });
        if (found) {
          return false;
        }
      }
      return (p.substr(-3) === '.js');
    }).map(function (x) {
      return fs.join(fs.join(PWD, 'makedata_suites'), x);
    }).sort();
  let executed_suites = [];
  suites.forEach(suitePath => {
    let column = [];
    let supported = "";
    let unsupported = "";
    let pseg = suitePath.split(fs.pathSeparator);
    let suite_filename = pseg[pseg.length - 1];    
    let suite = require("internal").load(suitePath);
    if (suite.isSupported(oldVersion, newVersion, options, enterprise, isCluster)) {
      let count = 0;
      wantFunctions.forEach(fn => {
        if (wantFunctions[count] in suite) {
          column.push(' X');
          supported += FNChars[count];
          if(!(previously_executed_suites.includes(suite_filename)) || !excludePreviouslyExecuted){
            fns[count].push(suite[fn]);
            executed_suites.push(suite_filename);
          }
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
    column.push(suite_filename);
    resultTable.addRow(column);
  });
  if (excludePreviouslyExecuted) {
    executed_suites.forEach(suite => { previously_executed_suites.push(suite); });
    fs.write(EXECUTED_TEST_SUITES_FILE, JSON.stringify(previously_executed_suites));
  }
  print(resultTable.toString());
  print(` in ${testDir}`);
  return fns;
}

function mainTestLoop(options, defaultDB, isCluster, enterprise, fns, endOfLoopFN) {
  let dbCount = options.countOffset;
  let totalCount = options.countOffset + options.numberOfDBs;
  while (dbCount < totalCount) {
    tStart = time();
    timeLine = [tStart];
    let database = defaultDB;
    if (options.numberOfDBs + options.countOffset > 1) {
      let c = zeroPad(dbCount + options.countOffset);
      database = `${database}_${c}`;
    }
    fns[0].forEach(func => {
      db._useDatabase('_system');
      if (db._databases().includes(database)) {
        db._useDatabase(database);
      }
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
        db._useDatabase('_system');
        if (db._databases().includes(database)) {
          db._useDatabase(database);
        }
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

function makeRandomString (l) {
  var r = rand();
  var d = rand();
  var s = "x";
  while (s.length < l) {
    s += r;
    r += d;
  }
  return s.slice(0, l);
};

function makeRandomNumber (low, high) {
  return (Math.abs(rand()) % (high - low)) + low;
};

function makeRandomTimeStamp () {
  return new Date(rand() * 1000).toISOString();
};

let rcount = 1; // for uniqueness
function resetRCount() { rcount = 1;}
function makeRandomDoc () {
  rcount += 1;
  let s = "";
  for (let i = 0; i < 10; ++i) {
    s += " " + makeRandomString(10);
  }
  return { Type: makeRandomNumber(1000, 65535),
           ID: makeRandomString(40),
           OptOut: rand() > 0 ? 1 : 0,
           Source: makeRandomString(14),
           dateLast: makeRandomTimeStamp(),
           a: "id" + rcount,
           b: makeRandomString(20),
           c: makeRandomString(40),
           text: s,
           position: {type: "Point",
                      coordinates: [makeRandomNumber(0, 3600) / 10.0,
                                    makeRandomNumber(-899, 899) / 10.0]
                     }};
};

function writeData (coll, n) {
  let wcount = 0;
  while (wcount < options.dataMultiplier) {
    let l = [];
    let times = [];

    for (let i = 0; i < n; ++i) {
      l.push(makeRandomDoc());
      if (l.length % 1000 === 0 || i === n - 1) {
        print("%");
        let t = time();
        coll.insert(l);
        let t2 = time();
        l = [];
        // print(i+1, t2-t);
        times.push(t2 - t);
      }
    }
    // Timings, if ever needed:
    // times = times.sort(function(a, b) { return a-b; });
    // print(" Median:", times[Math.floor(times.length / 2)], "\n",
    //       "90%ile:", times[Math.floor(times.length * 0.90)], "\n",
    //       "99%ile:", times[Math.floor(times.length * 0.99)], "\n",
    //       "min   :", times[0], "\n",
    //       "max   :", times[times.length-1]);
    wcount += 1;
  }
};

exports.makeRandomString = makeRandomString;
exports.makeRandomNumber = makeRandomNumber;
exports.makeRandomTimeStamp = makeRandomTimeStamp;
exports.makeRandomDoc = makeRandomDoc;
exports.resetRCount = resetRCount;
exports.writeData = writeData;
exports.scanMakeDataPaths = scanMakeDataPaths;
exports.mainTestLoop = mainTestLoop;
exports.getMetricValue = getMetricValue;
exports.createSafe = createSafe;
exports.progress = progress;
exports.getShardCount = getShardCount;
exports.getReplicationFactor = getReplicationFactor;
exports.writeGraphData = writeGraphData;
exports.createUseDatabaseSafe = createUseDatabaseSafe;
exports.createCollectionSafe = createCollectionSafe;
exports.createIndexSafe = createIndexSafe;
exports.runAqlQueryResultCount = runAqlQueryResultCount;
exports.runAqlQueryResultCountMultiply = runAqlQueryResultCountMultiply;
exports.setOptions = function (opts) { options = opts;};
Object.defineProperty(exports, 'options', { get: () => options });
