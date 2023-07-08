/* global print, semver, progress, createCollectionSafe, db, fs, PWD, _, assertTrue, assertEqual */

// this method will declare all the collection name with proper dbCount
let collections_names_declaration = (dbCount) => {
  return [
    `c0_101_${dbCount}`,
    `c1_101_${dbCount}`,
    `c2_insert_101_${dbCount}`,
    `c3_update_101_${dbCount}`,
    `c4_replace_101_${dbCount}`,
    `c5_not_null_101_${dbCount}`,
    `c6_hex_101_${dbCount}`,
    `c7_overwriteFalse_101_${dbCount}`,
    `c8_overwriteTrue_101_${dbCount}`,
    `c9_multiple_101_${dbCount}`,
    `c10_101_${dbCount}`
  ];
};

// this method will declare all the views name with proper dbCount
let views_names_declaration = (dbCount) => {
  return [
    `view_101_${dbCount}`,
    `view2_101_${dbCount}`
  ];
};

// This method will take db and a tuple parameter containing one query and one expected output
// as a tuple elements and then compare both's results
let result_comparison = (db, tuple) => {
  for (let i = 0; i < tuple.length; i++) {
    let query_str = tuple[i][0];
    let expected_output =  tuple[i][1];
    var output = db._query(query_str).toArray();
    var newOuput = Number(output);
    if (newOuput !== expected_output) {
      throw new Error(`101: ${query_str} query_str's output: ${newOuput} didn't match with ecxpected_output: ${expected_output}`);
    }
  }
};

// execute queries which use indexes and verify that the proper amount of docs are returned
function queries_for_collections(dbCount){
  // get all collections names wtih dbcount
  let collections_names = collections_names_declaration(dbCount);

  return [
    [`for doc in ${collections_names[0]} OPTIONS { indexHint : 'inverted', forceIndexHint: true, waitForSync: true } filter doc.cv_field == SOUNDEX('sky') collect with count into c return c`, 16000],
    [`for doc in ${collections_names[0]} OPTIONS { indexHint : 'persistent' } filter doc.cv_field == SOUNDEX('sky') collect with count into c return c`, 16000],

    [`for doc in ${collections_names[1]} OPTIONS { indexHint : 'inverted', forceIndexHint: true, waitForSync: true } filter doc.cv_field == SOUNDEX('dog') collect with count into c return c`, 16000],
    [`for doc in ${collections_names[1]} OPTIONS { indexHint : 'persistent' } filter doc.cv_field == SOUNDEX('dog') collect with count into c return c`, 16000],
    
    [`for doc in ${collections_names[2]} OPTIONS { indexHint : 'inverted', forceIndexHint: true, waitForSync: true } filter doc.cv_field_insert == SOUNDEX('frog') collect with count into c return c`, 16000],
    [`for doc in ${collections_names[2]} OPTIONS { indexHint : 'persistent' } filter doc.cv_field_insert == SOUNDEX('frog') collect with count into c return c`, 16000],
    
    [`for doc in ${collections_names[3]} OPTIONS { indexHint : 'inverted', forceIndexHint: true, waitForSync: true } filter doc.cv_field_update == SOUNDEX('beer') collect with count into c return c`, 16000],
    [`for doc in ${collections_names[3]} OPTIONS { indexHint : 'persistent' } filter doc.cv_field_update == SOUNDEX('beer') collect with count into c return c`, 16000],
    
    [`for doc in ${collections_names[4]} OPTIONS { indexHint : 'inverted', forceIndexHint: true, waitForSync: true } filter doc.cv_field_replace == SOUNDEX('water') collect with count into c return c`, 16000],
    [`for doc in ${collections_names[4]} OPTIONS { indexHint : 'persistent' } filter doc.cv_field_replace == SOUNDEX('water') collect with count into c return c`, 16000],
    
    [`for doc in ${collections_names[5]} OPTIONS { indexHint : 'inverted', forceIndexHint: true, waitForSync: true } filter doc.cv_field != null collect with count into c return c`, 0],
    [`for doc in ${collections_names[5]} OPTIONS { indexHint : 'persistent' } filter has(doc, 'cv_field') == true collect with count into c return c`, 0],
    
    [`for doc in ${collections_names[6]} OPTIONS { indexHint : 'inverted', forceIndexHint: true, waitForSync: true } filter doc.cv_field == TO_HEX(293) or doc.cv_field == TO_HEX(-293) collect with count into c return c`, 12],
    [`for doc in ${collections_names[6]} OPTIONS { indexHint : 'persistent' } filter doc.cv_field == TO_HEX(doc.name) collect with count into c return c`, 16000],
    
    [`let str = CONCAT('42_', "wsmcbzkhkl") for doc in ${collections_names[7]} OPTIONS { indexHint : 'inverted', forceIndexHint: true, waitForSync: true } filter doc.cv_field == str collect with count into c return c`, 18],
    [`let str = CONCAT('42_', "wsmcbzkhkl") for doc in ${collections_names[7]} OPTIONS { indexHint : 'persistent'} filter doc.cv_field == str collect with count into c return c`, 18],
    
    [`let str = CONCAT('42_', "bkatoehjob") for doc in ${collections_names[8]} OPTIONS { indexHint : 'inverted', forceIndexHint: true, waitForSync: true } filter doc.cv_field == str collect with count into c return c`, 32],
    [`let str = CONCAT('42_', "bkatoehjob") for doc in ${collections_names[8]} OPTIONS { indexHint : 'persistent' } filter doc.cv_field == str collect with count into c return c`, 32],
    
    [`for doc in ${collections_names[9]} OPTIONS { indexHint : 'inverted', forceIndexHint: true, waitForSync: true } filter doc.cv_field1 == 'foo' and doc.cv_field2 == 'bar' and doc.cv_field3 == 'baz' collect with count into c return c`, 16000],
    [`for doc in ${collections_names[9]} OPTIONS { indexHint : 'persistent' } filter doc.cv_field1 == 'foo' and doc.cv_field2 == 'bar' and doc.cv_field3 == 'baz' collect with count into c return c`, 16000],
    
    [`for doc in ${collections_names[10]} OPTIONS { indexHint : 'inverted', forceIndexHint: true, waitForSync: true } filter doc.cv_field == FIRST(for d in ${collections_names[10]} limit 1001, 1 return CONCAT(d._key, ' ', d._id, ' ', d._rev)) collect with count into c return c`, 1],
    [`for doc in ${collections_names[10]} OPTIONS { indexHint : 'persistent' } filter doc.cv_field == CONCAT(doc._key, ' ', doc._id, ' ', doc._rev) collect with count into c return c`, 16000]
  ];
}

// this function will provide all queries for views
function queries_for_views(dbCount) {
  // get all the view's variable name from the variable_name_declaration method globally
  let view = views_names_declaration(dbCount);
      // require("internal").sleep(120)
  
  return [
    [`for doc in ${view[0]} search doc.cv_field == SOUNDEX('sky') OPTIONS {waitForSync: true} collect with count into c return c`, 16000],
    [`for doc in ${view[0]} search doc.cv_field == SOUNDEX('dog') OPTIONS {waitForSync: true} collect with count into c return c`, 16000],
    [`for doc in ${view[0]} search doc.cv_field_insert == SOUNDEX('frog') OPTIONS {waitForSync: true} collect with count into c return c`, 16000],
    [`for doc in ${view[0]} search doc.cv_field_update == SOUNDEX('beer') OPTIONS {waitForSync: true} collect with count into c return c`, 16000],
    [`for doc in ${view[0]} search doc.cv_field_replace == SOUNDEX('water') OPTIONS {waitForSync: true} collect with count into c return c`, 16000],
    [`for doc in ${view[0]} filter doc.cv_field == to_hex(doc.name) collect with count into c return c`, 16000],
    [`for doc in ${view[0]} filter doc.cv_field == CONCAT('42_', TO_STRING(doc.field)) collect with count into c return c`, 25600],
    [`for doc in ${view[0]} search doc.cv_field1=='foo' and doc.cv_field2=='bar' and doc.cv_field3=='baz' OPTIONS {waitForSync: true} collect with count into c return c`, 16000],
    [`for doc in ${view[0]} filter doc.cv_field == CONCAT(doc._key, ' ', doc._id, ' ', doc._rev) collect with count into c return c`, 16000],
    
    [`for doc in ${view[1]} search doc.cv_field == SOUNDEX('sky') OPTIONS {waitForSync: true} collect with count into c return c`, 16000],
    [`for doc in ${view[1]} search doc.cv_field == SOUNDEX('dog') OPTIONS {waitForSync: true} collect with count into c return c`, 16000],
    [`for doc in ${view[1]} search doc.cv_field_insert == SOUNDEX('frog') OPTIONS {waitForSync: true} collect with count into c return c`, 16000],
    [`for doc in ${view[1]} search doc.cv_field_update == SOUNDEX('beer') OPTIONS {waitForSync: true} collect with count into c return c`, 16000],
    [`for doc in ${view[1]} search doc.cv_field_replace == SOUNDEX('water') OPTIONS {waitForSync: true} collect with count into c return c`, 16000],
    [`for doc in ${view[1]} search doc.cv_field == null OPTIONS {waitForSync: true} collect with count into c return c`, 16000],
    [`for doc in ${view[1]} filter doc.cv_field == to_hex(doc.name) collect with count into c return c`, 16000],
    [`for doc in ${view[1]} filter doc.cv_field == CONCAT('42_', TO_STRING(doc.field)) collect with count into c return c`, 25600],
    [`for doc in ${view[1]} search doc.cv_field1 =='foo' and doc.cv_field2=='bar' and doc.cv_field3=='baz' OPTIONS {waitForSync: true} collect with count into c return c`, 16000],
    [`for doc in ${view[1]} filter doc.cv_field == CONCAT(doc._key, ' ', doc._id, ' ', doc._rev) collect with count into c return c`, 16000]
  ];
}

// this function will compare properties objects
function compareProperties(name, obj1, obj2) {
  if (obj1.hasOwnProperty('optimizeTopK')) {
    delete obj1.optimizeTopK;
  }
  if (obj2.hasOwnProperty('optimizeTopK')) {
    delete obj2.optimizeTopK;
  }
  if(_.isEqual(obj1, obj2) === false){
    throw new Error(`101: Properties missmatched for the collection/view ${name} ${JSON.stringify(obj1)} <-> ${JSON.stringify(obj2)}`);
  }
};

(function () {
  return {
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      let currentVersionSemver = semver.parse(semver.coerce(currentVersion));
      let oldVersionSemver = semver.parse(semver.coerce(oldVersion));
      return semver.gte(currentVersionSemver, "3.10.0") && semver.gte(oldVersionSemver, "3.10.0");
    },

    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      // All items created must contain dbCount
      progress(`101: making per database data ${dbCount}`);
      progress("101: Creating collections with computed values");
      // getting all the collection names
      let collections_names = collections_names_declaration(dbCount);

      let c0 = createCollectionSafe (collections_names[0], 3, 3, { computedValues: [{ "name": "default", "expression": "RETURN SOUNDEX('sky')", overwrite: true }] });
      let c1 = createCollectionSafe (collections_names[1], 3, 3, { computedValues: [{ "name": "default", "expression": "RETURN SOUNDEX('dog')", overwrite: true }] });
      let c2 = createCollectionSafe (collections_names[2], 3, 3, { computedValues: [{ "name": "default_insert", "expression": "RETURN SOUNDEX('frog')", computeOn: ["insert"], overwrite: true }] });
      let c3 = createCollectionSafe (collections_names[3], 3, 3, { computedValues: [{ "name": "default_update", "expression": "RETURN SOUNDEX('beer')", computeOn: ["update"], overwrite: true }] });
      let c4 = createCollectionSafe (collections_names[4], 3, 3, { computedValues: [{ "name": "default_replace", "expression": "RETURN SOUNDEX('water')", computeOn: ["replace"], overwrite: true }] });
      let c5 = createCollectionSafe (collections_names[5], 3, 3, { computedValues: [{ "name": "default", "expression": "RETURN null", overwrite: true, keepNull: false }] });
      let c6 = createCollectionSafe (collections_names[6], 3, 3, { computedValues: [{ "name": "default", "expression": "RETURN TO_HEX(@doc.name)", overwrite: true }] });
      let c7 = createCollectionSafe (collections_names[7], 3, 3, { computedValues: [{ "name": "default", "expression": "RETURN CONCAT('42_', TO_STRING(@doc.field))", overwrite: false }] });
      let c8 = createCollectionSafe (collections_names[8], 3, 3, { computedValues: [{ "name": "default", "expression": "RETURN CONCAT('42_', TO_STRING(@doc.field))", overwrite: true }] });
      let c9 = createCollectionSafe(collections_names[9], 3, 3, { computedValues: [{ "name": "default1", "expression": "RETURN 'foo'", overwrite: true }, { "name": "default2", "expression": "RETURN 'bar'", overwrite: true }, { "name": "default3", "expression": "RETURN 'baz'", overwrite: true }] });
      let c10 = createCollectionSafe(collections_names[10], 3, 3, { computedValues: [{ "name": "default", "expression": "RETURN CONCAT(@doc._key, ' ', @doc._id, ' ', @doc._rev)", overwrite: true }] });
      //-------------------------------------------------------x-------------------------------------------------------------

      progress("101: Perform modification and comparison for desired output of Computed Values");

      let c0_expected = [
        {
          name: 'cv_field',
          expression: "RETURN SOUNDEX('sky')",
          computeOn: [ 'insert', 'update', 'replace' ],
          overwrite: true,
          failOnWarning: false,
          keepNull: true
        }
      ];
      let c0_actual = c0.properties({ computedValues: [{ "name": "cv_field", "expression": "RETURN SOUNDEX('sky')", overwrite: true }] });
      compareProperties(collections_names[0], c0_expected, c0_actual.computedValues);

      let c1_expected = [
        {
          name: 'cv_field',
          expression: "RETURN SOUNDEX('dog')",
          computeOn: [ 'insert', 'update', 'replace' ],
          overwrite: true,
          failOnWarning: false,
          keepNull: true
        }
      ];
      let c1_actual = c1.properties({ computedValues: [{ "name": "cv_field", "expression": "RETURN SOUNDEX('dog')", "overwrite": true }] });
      compareProperties(collections_names[1], c1_expected, c1_actual.computedValues);

      let c2_expected = [
        {
          name: 'cv_field_insert',
          expression: "RETURN SOUNDEX('frog')",
          computeOn: [ 'insert' ],
          overwrite: true,
          failOnWarning: false,
          keepNull: true
        }
      ];
      let c2_actual = c2.properties({ computedValues: [{ "name": "cv_field_insert", "expression": "RETURN SOUNDEX('frog')", "computeOn": ["insert"], "overwrite": true }] });
      compareProperties(collections_names[2], c2_expected, c2_actual.computedValues);

      let c3_expected = [
        {
          name: 'cv_field_update',
          expression: "RETURN SOUNDEX('beer')",
          computeOn: [ 'update' ],
          overwrite: true,
          failOnWarning: false,
          keepNull: true
        }
      ];
      let c3_actual = c3.properties({ computedValues: [{ "name": "cv_field_update", "expression": "RETURN SOUNDEX('beer')", "computeOn": ["update"], "overwrite": true }] });
      compareProperties(collections_names[3], c3_expected, c3_actual.computedValues);

      let c4_expected = [
        {
          name: 'cv_field_replace',
          expression: "RETURN SOUNDEX('water')",
          computeOn: [ 'replace' ],
          overwrite: true,
          failOnWarning: false,
          keepNull: true
        }
      ];
      let c4_actual = c4.properties({ computedValues: [{ "name": "cv_field_replace", "expression": "RETURN SOUNDEX('water')", "computeOn": ["replace"], "overwrite": true }] });
      compareProperties(collections_names[4], c4_expected, c4_actual.computedValues);

      let c5_expected = [
        {
          name: 'cv_field',
          expression: 'RETURN null',
          computeOn: [ 'insert', 'update', 'replace' ],
          overwrite: true,
          failOnWarning: false,
          keepNull: false
        }
      ];
      let c5_actual = c5.properties({ computedValues: [{ "name": "cv_field", "expression": "RETURN null", "overwrite": true, "keepNull": false }] });
      compareProperties(collections_names[5], c5_expected, c5_actual.computedValues);

      let c6_expected = [
        {
          name: 'cv_field',
          expression: 'RETURN TO_HEX(@doc.name)',
          computeOn: [ 'insert', 'update', 'replace' ],
          overwrite: true,
          failOnWarning: false,
          keepNull: true
        }
      ];
      let c6_actual = c6.properties({ computedValues: [{ "name": "cv_field", "expression": "RETURN TO_HEX(@doc.name)", "overwrite": true }] });
      compareProperties(collections_names[6], c6_expected, c6_actual.computedValues);

      let c7_expected = [
        {
          name: 'cv_field',
          expression: "RETURN CONCAT('42_', TO_STRING(@doc.field))",
          computeOn: [ 'insert', 'update', 'replace' ],
          overwrite: false,
          failOnWarning: false,
          keepNull: true
        }
      ];
      let c7_actual = c7.properties({ computedValues: [{ "name": "cv_field", "expression": "RETURN CONCAT('42_', TO_STRING(@doc.field))", "overwrite": false }] });
      compareProperties(collections_names[7], c7_expected, c7_actual.computedValues);

      let c8_expected = [
        {
          name: 'cv_field',
          expression: "RETURN CONCAT('42_', TO_STRING(@doc.field))",
          computeOn: [ 'insert', 'update', 'replace' ],
          overwrite: true,
          failOnWarning: false,
          keepNull: true
        }
      ];
      let c8_actual = c8.properties({ computedValues: [{ "name": "cv_field", "expression": "RETURN CONCAT('42_', TO_STRING(@doc.field))", "overwrite": true }] });
      compareProperties(collections_names[8], c8_expected, c8_actual.computedValues);

      let c9_expected = [
        {
          name: 'cv_field1',
          expression: "RETURN 'foo'",
          computeOn: [ 'insert', 'update', 'replace' ],
          overwrite: true,
          failOnWarning: false,
          keepNull: true
        },
        {
          name: 'cv_field2',
          expression: "RETURN 'bar'",
          computeOn: [ 'insert', 'update', 'replace' ],
          overwrite: true,
          failOnWarning: false,
          keepNull: true
        },
        {
          name: 'cv_field3',
          expression: "RETURN 'baz'",
          computeOn: [ 'insert', 'update', 'replace' ],
          overwrite: true,
          failOnWarning: false,
          keepNull: true
        }
      ];
      let c9_actual = c9.properties({ computedValues: [{ "name": "cv_field1", "expression": "RETURN 'foo'", "overwrite": true }, { "name": "cv_field2", "expression": "RETURN 'bar'", "overwrite": true }, { "name": "cv_field3", "expression": "RETURN 'baz'", "overwrite": true }] });
      compareProperties(collections_names[9], c9_expected, c9_actual.computedValues);

      let c10_expected = [
        {
          name: 'cv_field',
          expression: "RETURN CONCAT(@doc._key, ' ', @doc._id, ' ', @doc._rev)",
          computeOn: [ 'insert', 'update', 'replace' ],
          overwrite: true,
          failOnWarning: false,
          keepNull: true
        }
      ];
      let c10_actual = c10.properties({ computedValues: [{ "name": "cv_field", "expression": "RETURN CONCAT(@doc._key, ' ', @doc._id, ' ', @doc._rev)", "overwrite": true }] });
      compareProperties(collections_names[10], c10_expected, c10_actual.computedValues);

      //-------------------------------------------------------x-------------------------------------------------------------
      // Ensure 'inverted' and 'persistent' indexes on cv field for all collections

      c0.ensureIndex({"type":"inverted","name":"inverted","fields":[{"name":"cv_field"}]});
      c0.ensureIndex({"type":"persistent","name":"persistent","fields":["cv_field"], "sparse": true});  

      c1.ensureIndex({"type":"inverted","name":"inverted","fields":[{"name":"cv_field"}]});
      c1.ensureIndex({"type":"persistent","name":"persistent","fields":["cv_field"], "sparse": true});  

      c2.ensureIndex({"type":"inverted","name":"inverted","fields":[{"name": "cv_field_insert"}]});
      c2.ensureIndex({"type":"persistent","name":"persistent","fields":["cv_field_insert"], "sparse": true});  

      c3.ensureIndex({"type":"inverted","name":"inverted","fields":[{"name":"cv_field_update"}]});
      c3.ensureIndex({"type":"persistent","name":"persistent","fields":["cv_field_update"], "sparse": true});  

      c4.ensureIndex({"type":"inverted","name":"inverted","fields":[{"name":"cv_field_replace"}]});
      c4.ensureIndex({"type":"persistent","name":"persistent","fields":["cv_field_replace"], "sparse": true});  

      c5.ensureIndex({"type":"inverted","name":"inverted","fields":[{"name":"cv_field"}]});
      c5.ensureIndex({"type":"persistent","name":"persistent","fields":["cv_field"], "sparse": true});  

      c6.ensureIndex({"type":"inverted","name":"inverted","fields":[{"name":"cv_field"}]});
      c6.ensureIndex({"type":"persistent","name":"persistent","fields":["cv_field"], "sparse": true});  

      c7.ensureIndex({"type":"inverted","name":"inverted","fields":[{"name":"cv_field"}]});
      c7.ensureIndex({"type":"persistent","name":"persistent","fields":["cv_field"], "sparse": true});  

      c8.ensureIndex({"type":"inverted","name":"inverted","fields":[{"name":"cv_field"}]});
      c8.ensureIndex({"type":"persistent","name":"persistent","fields":["cv_field"], "sparse": true});  

      c9.ensureIndex({"type":"inverted","name":"inverted","fields":[{"name":"cv_field1"},{"name":"cv_field2"},{"name":"cv_field3"}]});
      c9.ensureIndex({"type":"persistent","name":"persistent","fields":["cv_field1", "cv_field2", "cv_field3"], "sparse": true});

      c10.ensureIndex({"type":"inverted","name":"inverted","fields":[{"name":"cv_field"}]});
      c10.ensureIndex({"type":"persistent","name":"persistent","fields":["cv_field"], "sparse": true});
      
      //-------------------------------------------------------x-------------------------------------------------------------
      
      // creating views for the collections
      progress("101: Creating computed values views with sample collections");
      
      // get all the view's variable name from the variable_name_declaration method globally
      let views = views_names_declaration(dbCount);
      
      // create 'arangosearch' view
      db._createView(views[0], "arangosearch");

      let creationOutput  = db[views[0]].properties(
        {"links":{
          [[collections_names[0]]]:{"fields": {"cv_field": {}},"includeAllFields":true},
          [[collections_names[1]]]:{"fields": {"cv_field": {}},"includeAllFields":true},
          [[collections_names[2]]]:{"fields": {"cv_field_insert": {}},"includeAllFields":true},
          [[collections_names[3]]]:{"fields": {"cv_field_update": {}},"includeAllFields":true},
          [[collections_names[4]]]:{"fields": {"cv_field_replace": {}},"includeAllFields":true},
          [[collections_names[5]]]:{"fields": {"cv_field": {}},"includeAllFields":true},
          [[collections_names[6]]]:{"fields": {"cv_field": {}},"includeAllFields":true},
          [[collections_names[7]]]:{"fields": {"cv_field": {}},"includeAllFields":true},
          [[collections_names[8]]]:{"fields": {"cv_field": {}},"includeAllFields":true},
          [[collections_names[9]]]:{"fields": {"cv_field1": {}, "cv_field2": {}, "cv_field3": {}},"includeAllFields":true},
          [[collections_names[10]]]:{"fields": {"cv_field": {}},"includeAllFields":true}
        }
      });

      let expected_output = {
        "cleanupIntervalStep" : 2,
        "commitIntervalMsec" : 1000,
        "consolidationIntervalMsec" : 1000,
        "consolidationPolicy" : {
          "type" : "tier",
          "segmentsBytesFloor" : 2097152,
          "segmentsBytesMax" : 5368709120,
          "segmentsMax" : 10,
          "segmentsMin" : 1,
          "minScore" : 0
        },
        "primarySort" : [ ],
        "primarySortCompression" : "lz4",
        "storedValues" : [ ],
        "writebufferActive" : 0,
        "writebufferIdle" : 64,
        "writebufferSizeMax" : 33554432,
        "links" : {
          [collections_names[0]] : {
            "analyzers" : [
              "identity"
            ],
            "fields" : {
              "cv_field" : {
              }
            },
            "includeAllFields" : true,
            "storeValues" : "none",
            "trackListPositions" : false
          },
          [collections_names[1]] : {
            "analyzers" : [
              "identity"
            ],
            "fields" : {
              "cv_field" : {
              }
            },
            "includeAllFields" : true,
            "storeValues" : "none",
            "trackListPositions" : false
          },
          [collections_names[2]] : {
            "analyzers" : [
              "identity"
            ],
            "fields" : {
              "cv_field_insert" : {
              }
            },
            "includeAllFields" : true,
            "storeValues" : "none",
            "trackListPositions" : false
          },
          [collections_names[3]] : {
            "analyzers" : [
              "identity"
            ],
            "fields" : {
              "cv_field_update" : {
              }
            },
            "includeAllFields" : true,
            "storeValues" : "none",
            "trackListPositions" : false
          },
          [collections_names[4]] : {
            "analyzers" : [
              "identity"
            ],
            "fields" : {
              "cv_field_replace" : {
              }
            },
            "includeAllFields" : true,
            "storeValues" : "none",
            "trackListPositions" : false
          },
          [collections_names[5]] : {
            "analyzers" : [
              "identity"
            ],
            "fields" : {
              "cv_field" : {
              }
            },
            "includeAllFields" : true,
            "storeValues" : "none",
            "trackListPositions" : false
          },
          [collections_names[6]] : {
            "analyzers" : [
              "identity"
            ],
            "fields" : {
              "cv_field" : {
              }
            },
            "includeAllFields" : true,
            "storeValues" : "none",
            "trackListPositions" : false
          },
          [collections_names[7]] : {
            "analyzers" : [
              "identity"
            ],
            "fields" : {
              "cv_field" : {
              }
            },
            "includeAllFields" : true,
            "storeValues" : "none",
            "trackListPositions" : false
          },
          [collections_names[8]] : {
            "analyzers" : [
              "identity"
            ],
            "fields" : {
              "cv_field" : {
              }
            },
            "includeAllFields" : true,
            "storeValues" : "none",
            "trackListPositions" : false
          },
          [collections_names[9]] : {
            "analyzers" : [
              "identity"
            ],
            "fields" : {
              "cv_field1" : {
              },
              "cv_field2" : {
              },
              "cv_field3" : {
              }
            },
            "includeAllFields" : true,
            "storeValues" : "none",
            "trackListPositions" : false
          },
          [collections_names[10]] : {
            "analyzers" : [
              "identity"
            ],
            "fields" : {
              "cv_field" : {
              }
            },
            "includeAllFields" : true,
            "storeValues" : "none",
            "trackListPositions" : false
          }
        }
      };

      // this method will compare two outputs
      compareProperties(`${views[0]}`, creationOutput, expected_output);

      // create 'search-alias' view
      db._createView(views[1], "search-alias", {
        "indexes": [
          {
            'collection': collections_names[0],
            'index': 'inverted'
          },
          {
            'collection': collections_names[1],
            'index': 'inverted'
          },
          {
            'collection': collections_names[2],
            'index': 'inverted'
          },
          {
            'collection': collections_names[3],
            'index': 'inverted'
          },
          {
            'collection': collections_names[4],
            'index': 'inverted'
          },
          {
            'collection': collections_names[5],
            'index': 'inverted'
          },
          {
            'collection': collections_names[6],
            'index': 'inverted'
          },
          {
            'collection': collections_names[7],
            'index': 'inverted'
          },
          {
            'collection': collections_names[8],
            'index': 'inverted'
          },
          {
            'collection': collections_names[9],
            'index': 'inverted'
          },
          {
            'collection': collections_names[10],
            'index': 'inverted'
          }
        ]
      });

      // inserting data to all collection
      let data_array = [c0, c1, c2, c3, c4, c5, c6, c7, c8, c9, c10];
      let docsAsStr = fs.read(`${PWD}/makedata_suites/101_collections_data.json`);

      // this function will read and insert and check all the neccessary data for the respective collection
      data_array.forEach(col => {

        progress(`101: Insert docs into collection ${col.name()} with computed values`);
        col.save(JSON.parse(docsAsStr), { silent: true });

        //this cmd will find one docs from the collection
        let has_cv_field = col.all().toArray();
        // checking computed value field exit on the collection's doc
        if (col === c0 || col === c1 || col === c6 || col === c7 || col === c8 || col === c10) {
          if (!has_cv_field.some(obj => obj.hasOwnProperty("cv_field"))) {
            throw new Error(`101: Computed value field 'cv_field' missing from collection ${col.name}`);
          }
        }
        else if (col === c2) {
          if (!has_cv_field.some(obj => obj.hasOwnProperty("cv_field_insert"))) {
            throw new Error(`101: Computed value field 'cv_field' missing from collection ${col.name}`);
          }
        }
        else if (col === c3 || col === c4) {
          if (!has_cv_field.some(obj => obj.hasOwnProperty("cv_field"))) {
            throw new Error(`101: Computed value field 'cv_field' missing from collection ${col.name}`);
          }
        }
        else if (col === c5) {
          if (has_cv_field.some(obj => obj.hasOwnProperty("cv_field"))) {
            throw new Error(`101: Computed value field 'cv_field' is present for ${col.name}`);
          }
        } 
        else if (col === c9) {
          if (!has_cv_field.some(obj => obj.hasOwnProperty("cv_field"))) {
            throw new Error(`101: Computed value field 'cv_field' missing from collection ${col.name}`);
          }
        }
      });

      // Verify collection c3
      let c3_count_before = db._query(`for doc in ${collections_names[3]} filter has(doc, 'cv_field_update') == true collect with count into c return c`).toArray();
      if (isNaN(Number(c3_count_before))) {
        throw new Error(`101: Can't get number during quering ${collections_names[3]}: Got ${c3_count_before}`);
      }
      c3_count_before = Number(c3_count_before);
      assertEqual(c3_count_before, 0); // Check that we have no computed values

      // Perform UPDATE operation
      db._query(`FOR doc IN ${collections_names[3]} UPDATE doc WITH { cv_field_update: 'update' } IN ${collections_names[3]}`);
      let c3_count_after = db._query(`for doc in ${collections_names[3]} filter doc.cv_field_update == soundex('beer') collect with count into c return c`).toArray();
      if (isNaN(Number(c3_count_after))) {
        throw new Error(`101: Can't get number during quering ${collections_names[3]}: Got ${c3_count_after}`);
      }
      c3_count_after = Number(c3_count_after);
      assertEqual(c3_count_after, 16000); // Check that Computed Values are created

      // Verify collection c4
      let c4_count_before = db._query(`for doc in ${collections_names[4]} filter has(doc, 'cv_field_replace') == true collect with count into c return c`).toArray();
      if (isNaN(Number(c4_count_before))) {
        throw new Error(`101: Can't get number during quering ${collections_names[4]}: Got ${c4_count_before}`);
      }
      c4_count_before = Number(c4_count_before);
      assertEqual(c4_count_before, 0); // Check that we have no computed values

      /* BTS-1508: re-enable for triggering again.
      // Perform REPLACE operation
      db._query(`FOR doc IN ${collections_names[4]} REPLACE doc WITH { cv_field_replace: 'replace' } IN ${collections_names[4]}`);
      let c4_count_after = db._query(`for doc in ${collections_names[4]} filter doc.cv_field_replace == soundex('water') collect with count into c return c`).toArray();
      if (isNaN(Number(c4_count_after))) {
        throw new Error(`101: Can't get number during quering ${collections_names[4]}: Got ${c4_count_after}`);
      }
      c4_count_after = Number(c4_count_after);
      assertEqual(c4_count_after, 16000); // Check that Computed Values are created

      //execute queries which use views and verify that the proper amount of docs are returned
      let collections_queries = queries_for_collections(dbCount);
      result_comparison(db, collections_queries);

      //execute queries which use views and verify that the proper amount of docs are returned
      let views_queries = queries_for_views(dbCount);
      result_comparison(db, views_queries);
      */

      return 0;
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      progress(`101: checking data ${dbCount}`);
      //execute queries which use views and verify that the proper amount of docs are returned
      let collections_queries = queries_for_collections(dbCount);

      // require("internal").sleep(120)
      result_comparison(db, collections_queries);

      //execute queries which use views and verify that the proper amount of docs are returned
      let views_queries = queries_for_views(dbCount);
      result_comparison(db, views_queries);

      return 0;
    },
    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      progress(`101: clearing data ${dbCount}`);

      // get all the view's variable name from the variable_name_declaration method globally
      let views = views_names_declaration(dbCount);

      try {
        db._dropView(`${views[0]}`);
        db._dropView(`${views[1]}`);
      } catch (error) {
        console.log('101: Deleting view failed with :', error.message);
        throw error;
      }
      progress("101: deleted views");

      // getting all the collection name with dbcount
      let c = collections_names_declaration(dbCount);
      c.forEach(col => {
        db[col].properties({computedValues: []});
        //checking the properties set to null properly
        if (db[col].properties()["computedValues"] === null) {
          //drop the collection after check
          db._drop(col);
          progress(`101: deleting ${col} collection`);
        } else {
          throw new Error(`101: ${col} deletion failed!`);
        }
      });
      
      return 0;
    }
  };

}());
