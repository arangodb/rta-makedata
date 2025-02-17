/* global print, semver, progress, createSafe, createCollectionSafe, db, analyzers, _, arango */
/*jslint maxlen: 100*/

const analyzers = require("@arangodb/analyzers");
function createAnalyzer(testgroup, analyzerName, analyzerCreationQuery){
  // creating analyzer
  let text = createSafe(analyzerName,
                        function () {
                          return analyzerCreationQuery;
                        }, function () {
                          if (analyzers.analyzer(analyzerName) === null) {
                            throw new Error(`${testgroup}: ${analyzerName} analyzer creation failed!`);
                          }
                        });
}


function createAnalyzerSet(testgroup, test) {
  let q = analyzers.save(test.analyzerName,
                         ...test.analyzerProperties
                        );
  if (test.hasOwnProperty('collection')) {
    progress(`${testgroup}: creating collection ${test.collection}`);
    createCollectionSafe(test.collection, 2, 1).insert(test.colTestData);
    progress(`${testgroup}: creating view ${test.bindVars["@testView"]}`);
    db._createView(test.bindVars["@testView"],
                   "arangosearch", {
                     links: {
                       [test.collection]:
                       {
                         analyzers: [test.analyzerName],
                         includeAllFields: true
                       }
                     }
                   }
                  );
  }
  progress(`${testgroup}: creating analyzer ${test.analyzerName}`);
  createAnalyzer(test.analyzerName, q);
}

//This function will check any analyzer's properties
function checkProperties(testgroup, analyzer_name, obj1, obj2) {
  if (obj1.hasOwnProperty('legacy')) {
    obj2['legacy'] = obj1['legacy'];
  }

  if (!_.isEqual(obj1, obj2)) {
    throw new Error(`${testgroup}: ${analyzer_name} analyzer's type missmatched! ${JSON.stringify(obj1)} != ${JSON.stringify(obj2)}`);
  }
};

//This function will check any analyzer's equality with expected server response
function arraysEqual(analyzer_name, a, b) {
  if (!_.isEqual(a, b)) {
    throw new Error(`${analyzer_name}: Didn't get the expected response from the server! ${JSON.stringify(a)} != ${JSON.stringify(b)}`);
  }
}

function dumpAnalyzerCollection() {
  print(`${Date()} Dumping analyzers`);
  print("--------------------------------------------------------------------------------");
  print(JSON.stringify(db._analyzers.toArray()));
  print("--------------------------------------------------------------------------------");
  print(`${Date()} DONE`);
}

// this function will check everything regarding given analyzer
function checkAnalyzerSet(testgroup, test){
  progress(`${testgroup}: ${test.analyzerName} running query ${test.query}`);
  let queryResult;
  try {
    queryResult = db._query(test);
  }
  catch (ex) {
    dumpAnalyzerCollection();
    throw ex;
  }

  if (analyzers.analyzer(test.analyzerName) === null) {
    dumpAnalyzerCollection();
    throw new Error(`${testgroup}: ${test.analyzerName} analyzer creation failed!`);
  }

  progress(`${testgroup}: ${test.analyzerName} checking analyzer's name`);
  let testName = analyzers.analyzer(test.analyzerName).name();
  let expectedName = `${arango.getDatabaseName()}::${test.analyzerName}`;
  if (testName !== expectedName) {
    dumpAnalyzerCollection();
    throw new Error(`${testgroup}: ${test.analyzerName} analyzer not found`);
  }

  progress(`${testgroup}: ${test.analyzerName} checking analyzer's type`);
  let testType = analyzers.analyzer(test.analyzerName).type();
  if (testType !== test.analyzerType){
    dumpAnalyzerCollection();
    throw new Error(`${testgroup}: ${test.analyzerName} analyzer type missmatched! ${testType} != ${test.analyzerType}`);
  }

  progress(`${testgroup}: ${test.analyzerName} checking analyzer's properties`);
  let testProperties = analyzers.analyzer(test.analyzerName).properties();
  checkProperties(testgroup, test.analyzerName, testProperties, test.properties);

  progress(`${testgroup}: ${test.analyzerName} checking analyzer's query results`);
  let actual = queryResult.toArray();

  arraysEqual(test.analyzerName, test.expectedResult, actual);

  progress(`${testgroup}: ${test.analyzerName} done`);
}

function deleteAnalyzer(testgroup, analyzerName){
  const array = analyzers.toArray();
  for (let i = 0; i < array.length; i++) {
    const name = array[i].name().replace(`${arango.getDatabaseName()}::`, '');
    if (name === analyzerName) {
      analyzers.remove(analyzerName);
    }
  }
  // checking created text analyzer is deleted or not
  if (analyzers.analyzer(analyzerName) != null) {
    throw new Error(`${testgroup}: ${analyzerName} analyzer isn't deleted yet: ${analyzers.toArray()}`);
  }
  progress(`${testgroup}: deleted ${analyzerName}`);
}

function deleteAnalyzerSet(testgroup, test) {
  if (test.hasOwnProperty('collection')) {
    print(`${testgroup}: deleting view ${test.bindVars['@testView']} `);
    try {
      db._dropView(test.bindVars['@testView']);
    } catch (ex) {
      print(`${Date()} 600: ${ex} ${ex.stack}`);
    }
    print(`${testgroup}: deleting collection ${test.collection} `);
    try {
      db._drop(test.collection);
    } catch (ex) {
      print(`${Date()} 600: ${ex} ${ex.stack}`);
    }
  }
  print(`${Date()} 600: ${testgroup}: deleting Analyzer ${test.analyzerName}`);
  deleteAnalyzer(testgroup, test.analyzerName);
}


exports.createAnalyzerSet = createAnalyzerSet;
exports.checkAnalyzerSet = checkAnalyzerSet;
exports.deleteAnalyzerSet = deleteAnalyzerSet;
