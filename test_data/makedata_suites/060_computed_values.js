/* global print, semver, progress, createCollectionSafe, db, fs, PWD */

// this method will declare all the collection name with proper dbCount
let collection_declaration = (dbCount) =>{

  let collection_array = [
    `c1_060_${dbCount}`,
    `c2_060_${dbCount}`,
    `c3_insert_060_${dbCount}`,
    `c4_update_060_${dbCount}`,
    `c5_replace_060_${dbCount}`,
    `c6_not_null_060_${dbCount}`,
    `c7_hex_060_${dbCount}`,
    `c8_overwriteFalse_060_${dbCount}`,
    `c9_overwriteTrue_060_${dbCount}`,
    `c10_multiple_060_${dbCount}`,
    `c11_060_${dbCount}`,
    `c12_060_${dbCount}`
  ];

  return collection_array;
};

// this method will declare all the views name with proper dbCount
let views_name_declaration = (dbCount) =>{

  let views_Name_array = [
    `test_view_${dbCount}`,
    `test_view2_${dbCount}`
  ];

  return views_Name_array;
};

// This method will take db and a tuple parameter containing one query and one expected output
// as a touple elements and then compare both's results
let result_comparision = (db, tuple) =>{
  for (let i = 0; i < tuple.length; i++) {
    let query_str = tuple[i][0];
    let expected_output =  tuple[i][1];
    var output = db._query(query_str).toArray();
    var newOuput = Number(output);
      if (newOuput !== expected_output) {
        throw new Error(`${query_str} query_str's output: ${newOuput} didn't match with ecxpected_output: ${expected_output}`);
      }
  }
}


//execute queries which use indexes and verify that the proper amount of docs are returned
function index_array(dbCount){
  // get all the collection variable name wtih dbcount
  let c = collection_declaration(dbCount);

  let index_tuple = [
    [`for doc in ${c[0]} OPTIONS { indexHint : 'inverted', forceIndexHint: true, waitForSync: true } filter doc.cv_field == SOUNDEX('sky') collect with count into c return c`, 64000],
    [`for doc in ${c[0]} OPTIONS { indexHint : 'persistent' } filter doc.cv_field == SOUNDEX('sky') collect with count into c return c`, 64000],
    [`for doc in ${c[1]} OPTIONS { indexHint : 'inverted', forceIndexHint: true, waitForSync: true } filter doc.cv_field == SOUNDEX('dog') collect with count into c return c`, 64000],
    [`for doc in ${c[1]} OPTIONS { indexHint : 'persistent' } filter doc.cv_field == SOUNDEX('dog') collect with count into c return c`, 64000],
    [`for doc in ${c[2]} OPTIONS { indexHint : 'inverted', forceIndexHint: true, waitForSync: true } filter doc.cv_field_insert == SOUNDEX('frog') collect with count into c return c`, 64000],
    [`for doc in ${c[2]} OPTIONS { indexHint : 'persistent' } filter doc.cv_field_insert == SOUNDEX('frog') collect with count into c return c`, 64000],
    [`for doc in ${c[3]} OPTIONS { indexHint : 'inverted', forceIndexHint: true, waitForSync: true } filter doc.cv_field_update == SOUNDEX('beer') collect with count into c return c`, 0],
    [`for doc in ${c[3]} OPTIONS { indexHint : 'persistent' } filter doc.cv_field_update == SOUNDEX('beer') collect with count into c return c`, 0],
    [`for doc in ${c[4]} OPTIONS { indexHint : 'inverted', forceIndexHint: true, waitForSync: true } filter doc.cv_field_replace == SOUNDEX('water') collect with count into c return c`, 0],
    [`for doc in ${c[4]} OPTIONS { indexHint : 'persistent' } filter doc.cv_field_replace == SOUNDEX('water') collect with count into c return c`, 0],
    [`for doc in ${c[5]} OPTIONS { indexHint : 'inverted', forceIndexHint: true, waitForSync: true } filter doc.cv_field == null collect with count into c return c`, 64000],
    [`for doc in ${c[5]} OPTIONS { indexHint : 'persistent' } filter has(doc, 'cv_field') == true collect with count into c return c`, 0],
    [`for doc in ${c[6]} OPTIONS { indexHint : 'inverted', forceIndexHint: true, waitForSync: true } filter doc.cv_field == TO_HEX(123) collect with count into c return c`, 11],
    [`for doc in ${c[6]} OPTIONS { indexHint : 'persistent' } filter doc.cv_field == TO_HEX(doc.name) collect with count into c return c`, 64000],
    [`for doc in ${c[7]} OPTIONS { indexHint : 'inverted', forceIndexHint: true, waitForSync: true } filter doc.cv_field == CONCAT('42_', FIRST(for d in ${c[7]} limit 100, 1 return d.field)) collect with count into c return c`, 17],
    [`for doc in ${c[7]} OPTIONS { indexHint : 'persistent' } filter doc.cv_field == CONCAT('42_', TO_STRING(doc.field)) collect with count into c return c`, 32000],
    [`for doc in ${c[8]} OPTIONS { indexHint : 'inverted', forceIndexHint: true, waitForSync: true } filter doc.cv_field == CONCAT('42_', FIRST(for d in ${c[8]} limit 101, 1 return d.field)) collect with count into c return c`, 33],
    [`for doc in ${c[8]} OPTIONS { indexHint : 'persistent' } filter doc.cv_field == CONCAT('42_', TO_STRING(doc.field)) collect with count into c return c`, 64000],
    [`for doc in ${c[9]} OPTIONS { indexHint : 'persistent' } filter doc.cv_field1 == 'foo' and doc.cv_field2 == 'bar' and doc.cv_field3 == 'baz' collect with count into c return c`, 64000],
    [`for doc in ${c[10]} OPTIONS { indexHint : 'inverted', forceIndexHint: true, waitForSync: true } filter doc.cv_field == FIRST(for d in ${c[10]} limit 1001, 1 return CONCAT(d._key, ' ', d._id, ' ', d._rev)) collect with count into c return c`, 1],
    [`for doc in ${c[10]} OPTIONS { indexHint : 'persistent' } filter doc.cv_field == CONCAT(doc._key, ' ', doc._id, ' ', doc._rev) collect with count into c return c`, 64000]
  ];
  return index_tuple;
}

// this function will provide all the queries for views
function views_array(dbCount) {
  // get all the view's variable name from the variable_name_declaration method globally
  let view = views_name_declaration(dbCount);
  
  let view_tuples = [
    [`for doc in ${view[0]} search doc.cv_field == SOUNDEX('sky') collect with count into c return c`, 64000],
    [`for doc in ${view[0]} search doc.cv_field == SOUNDEX('dog') collect with count into c return c`, 64000],
    [`for doc in ${view[0]} search doc.cv_field_insert == SOUNDEX('frog') collect with count into c return c`, 64000],
    [`for doc in ${view[0]} search doc.cv_field_update == SOUNDEX('beer') collect with count into c return c`, 0],
    [`for doc in ${view[0]} search doc.cv_field_replace == SOUNDEX('water') collect with count into c return c`, 0],
    [`for doc in ${view[0]} filter doc.cv_field == to_hex(doc.name) collect with count into c return c`, 64000],
    [`for doc in ${view[0]} filter doc.cv_field == CONCAT('42_', TO_STRING(doc.field)) collect with count into c return c`, 96000],
    [`for doc in ${view[0]} search doc.cv_field1=='foo' and doc.cv_field2=='bar' and doc.cv_field3=='baz' collect with count into c return c`, 64000],
    [`for doc in ${view[0]} filter doc.cv_field == CONCAT(doc._key, ' ', doc._id, ' ', doc._rev) collect with count into c return c`, 64000],
    [`for doc in ${view[1]} search doc.cv_field == SOUNDEX('sky') collect with count into c return c`, 64000],
    [`for doc in ${view[1]} search doc.cv_field == SOUNDEX('dog') collect with count into c return c`, 64000],
    [`for doc in ${view[1]} search doc.cv_field_insert == SOUNDEX('frog') collect with count into c return c`, 64000],
    [`for doc in ${view[1]} search doc.cv_field_update == SOUNDEX('beer') collect with count into c return c`, 0],
    [`for doc in ${view[1]} search doc.cv_field_replace == SOUNDEX('water') collect with count into c return c`, 0],
    [`for doc in ${view[1]} search doc.cv_field == null collect with count into c return c`, 64000],
    [`for doc in ${view[1]} filter doc.cv_field == to_hex(doc.name) collect with count into c return c`, 64000],
    [`for doc in ${view[1]} filter doc.cv_field == CONCAT('42_', TO_STRING(doc.field)) collect with count into c return c`, 96000],
    [`for doc in ${view[1]} search doc.cv_field1=='foo' and doc.cv_field2=='bar' and doc.cv_field3=='baz' collect with count into c return c`, 64000],
    [`for doc in ${view[1]} filter doc.cv_field == CONCAT(doc._key, ' ', doc._id, ' ', doc._rev) collect with count into c return c`, 64000]
  ]
  return view_tuples;
}


(function () {
  const a = require("@arangodb/analyzers");
  return {
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      let oldVersionSemver = semver.parse(semver.coerce(oldVersion));
      return semver.gte(oldVersionSemver, "3.10.0");
    },

    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      // All items created must contain dbCount
      print(`060: making per database data ${dbCount}`);
      print("060: Creating computed values with sample collections");
      // getting all the collection names
      let c = collection_declaration(dbCount);

      let c1 = createCollectionSafe(c[0], 3, 3, { computedValues: [{ "name": "default", "expression": "RETURN SOUNDEX('sky')", overwrite: true }] });
      let c2 = createCollectionSafe(c[1], 3, 3, { computedValues: [{ "name": "default", "expression": "RETURN SOUNDEX('dog')", overwrite: true }] });
      let c3 = createCollectionSafe(c[2], 3, 3, { computedValues: [{ "name": "default_insert", "expression": "RETURN SOUNDEX('frog')", computeOn: ["insert"], overwrite: true }] });
      let c4 = createCollectionSafe(c[3], 3, 3, { computedValues: [{ "name": "default_update", "expression": "RETURN SOUNDEX('beer')", computeOn: ["update"], overwrite: true }] });
      let c5 = createCollectionSafe(c[4], 3, 3, { computedValues: [{ "name": "default_replace", "expression": "RETURN SOUNDEX('water')", computeOn: ["replace"], overwrite: true }] });
      let c6 = createCollectionSafe(c[5], 3, 3, { computedValues: [{ "name": "default", "expression": "RETURN null", overwrite: true, keepNull: false }] });
      let c7 = createCollectionSafe(c[6], 3, 3, { computedValues: [{ "name": "default", "expression": "RETURN TO_HEX(@doc.name)", overwrite: true }] });
      let c8 = createCollectionSafe(c[7], 3, 3, { computedValues: [{ "name": "default", "expression": "RETURN CONCAT('42_', TO_STRING(@doc.field))", overwrite: false }] });
      let c9 = createCollectionSafe(c[8], 3, 3, { computedValues: [{ "name": "default", "expression": "RETURN CONCAT('42_', TO_STRING(@doc.field))", overwrite: true }] });
      let c10 = createCollectionSafe(c[9], 3, 3, { computedValues: [{ "name": "default1", "expression": "RETURN 'foo'", overwrite: true }, { "name": "default2", "expression": "RETURN 'bar'", overwrite: true }, { "name": "default3", "expression": "RETURN 'baz'", overwrite: true }] });
      let c11 = createCollectionSafe(c[10], 3, 3, { computedValues: [{ "name": "default", "expression": "RETURN CONCAT(@doc._key, ' ', @doc._id, ' ', @doc._rev)", overwrite: true }] });
      let c12 = createCollectionSafe(c[11], 3, 3, { computedValues: [{ "name": "default", "expression": "RETURN [{from_doc: CONCAT(@doc.name, ' ', @doc.field), system:{_key: @doc._key, _rev: @doc._rev, _id: @doc._id}, values: [RANGE(1, 10)]}]", overwrite: true }] });
      //-------------------------------------------------------x-------------------------------------------------------------

      // this function will check Computed Values properties
      function checkComValProperties(comValueName, obj1, obj2) {
        if (obj1.hasOwnProperty('optimizeTopK')) {
          delete obj1.optimizeTopK;
        }
        if (obj2.hasOwnProperty('optimizeTopK')) {
          delete obj2.optimizeTopK;
        }
        if(_.isEqual(obj1, obj2) === false){
          throw new Error(`Properties missmatched for the collection ${comValueName} ${JSON.stringify(obj1)} <-> ${JSON.stringify(obj2)}`);
        }
      }

      print("060: Perform modification and comparision for desired output of Computed Values");
      //for c1 comVal
      let c1_exp_modification = [
        {
          name: 'cv_field',
          expression: "RETURN SOUNDEX('sky')",
          computeOn: [ 'insert', 'update', 'replace' ],
          overwrite: true,
          failOnWarning: false,
          keepNull: true
        }
      ];

      let c1_actual_modification = c1.properties({ computedValues: [{ "name": "cv_field", "expression": "RETURN SOUNDEX('sky')", overwrite: true }] });

      checkComValProperties(c[0], c1_exp_modification, c1_actual_modification.computedValues);

      //for c2 comVal
      let c2_exp_modification = [
        {
          name: 'cv_field',
          expression: "RETURN SOUNDEX('dog')",
          computeOn: [ 'insert', 'update', 'replace' ],
          overwrite: true,
          failOnWarning: false,
          keepNull: true
        }
      ];

      let c2_actual_modification = c2.properties({ computedValues: [{ "name": "cv_field", "expression": "RETURN SOUNDEX('dog')", "overwrite": true }] })

      checkComValProperties(c[1], c2_exp_modification, c2_actual_modification.computedValues);

      //for c3_insert comVal
      let c3_exp_modification = [
        {
          name: 'cv_field_insert',
          expression: "RETURN SOUNDEX('frog')",
          computeOn: [ 'insert' ],
          overwrite: true,
          failOnWarning: false,
          keepNull: true
        }
      ];

      let c3_actual_modification = c3.properties({ computedValues: [{ "name": "cv_field_insert", "expression": "RETURN SOUNDEX('frog')", "computeOn": ["insert"], "overwrite": true }] })

      checkComValProperties(c[2], c3_exp_modification, c3_actual_modification.computedValues);

      //for c4_update comVal
      let c4_exp_modification = [
        {
          name: 'cv_field_update',
          expression: "RETURN SOUNDEX('beer')",
          computeOn: [ 'update' ],
          overwrite: true,
          failOnWarning: false,
          keepNull: true
        }
      ];

      let c4_actual_modification = c4.properties({ computedValues: [{ "name": "cv_field_update", "expression": "RETURN SOUNDEX('beer')", "computeOn": ["update"], "overwrite": true }] });

      checkComValProperties(c[3], c4_exp_modification, c4_actual_modification.computedValues);

      //for c5_replace comVal
      let c5_exp_modification = [
        {
          name: 'cv_field_replace',
          expression: "RETURN SOUNDEX('water')",
          computeOn: [ 'replace' ],
          overwrite: true,
          failOnWarning: false,
          keepNull: true
        }
      ];

      let c5_actual_modification = c5.properties({ computedValues: [{ "name": "cv_field_replace", "expression": "RETURN SOUNDEX('water')", "computeOn": ["replace"], "overwrite": true }] })

      checkComValProperties(c[4], c5_exp_modification, c5_actual_modification.computedValues);

      //for c6_not_null comVal
      let c6_exp_modification = [
        {
          name: 'cv_field',
          expression: 'RETURN null',
          computeOn: [ 'insert', 'update', 'replace' ],
          overwrite: true,
          failOnWarning: false,
          keepNull: false
        }
      ];

      let c6_actual_modification = c6.properties({ computedValues: [{ "name": "cv_field", "expression": "RETURN null", "overwrite": true, "keepNull": false }] });

      checkComValProperties(c[5], c6_exp_modification, c6_actual_modification.computedValues);

      //for c7_hex comVal
      let c7_exp_modification = [
        {
          name: 'cv_field',
          expression: 'RETURN TO_HEX(@doc.name)',
          computeOn: [ 'insert', 'update', 'replace' ],
          overwrite: true,
          failOnWarning: false,
          keepNull: true
        }
      ];

      let c7_actual_modification = c7.properties({ computedValues: [{ "name": "cv_field", "expression": "RETURN TO_HEX(@doc.name)", "overwrite": true }] });

      checkComValProperties(c[6], c7_exp_modification, c7_actual_modification.computedValues);

      //for c8_overwriteFalse comVal
      let c8_exp_modification = [
        {
          name: 'cv_field',
          expression: "RETURN CONCAT('42_', TO_STRING(@doc.field))",
          computeOn: [ 'insert', 'update', 'replace' ],
          overwrite: false,
          failOnWarning: false,
          keepNull: true
        }
      ];

      let c8_actual_modification = c8.properties({ computedValues: [{ "name": "cv_field", "expression": "RETURN CONCAT('42_', TO_STRING(@doc.field))", "overwrite": false }] });

      checkComValProperties(c[7], c8_exp_modification, c8_actual_modification.computedValues);

      //for c9_overwriteTrue comVal
      let c9_exp_modification = [
        {
          name: 'cv_field',
          expression: "RETURN CONCAT('42_', TO_STRING(@doc.field))",
          computeOn: [ 'insert', 'update', 'replace' ],
          overwrite: true,
          failOnWarning: false,
          keepNull: true
        }
      ];

      let c9_actual_modification = c9.properties({ computedValues: [{ "name": "cv_field", "expression": "RETURN CONCAT('42_', TO_STRING(@doc.field))", "overwrite": true }] });

      checkComValProperties(c[8], c9_exp_modification, c9_actual_modification.computedValues);

      //for c10_multiple comVal
      let c10_exp_modification = [
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

      let c10_actual_modification = c10.properties({ computedValues: [{ "name": "cv_field1", "expression": "RETURN 'foo'", "overwrite": true }, { "name": "cv_field2", "expression": "RETURN 'bar'", "overwrite": true }, { "name": "cv_field3", "expression": "RETURN 'baz'", "overwrite": true }] })

      checkComValProperties(c[9], c10_exp_modification, c10_actual_modification.computedValues);

      //for c11 comVal
      let c11_exp_modification = [
        {
          name: 'cv_field',
          expression: "RETURN CONCAT(@doc._key, ' ', @doc._id, ' ', @doc._rev)",
          computeOn: [ 'insert', 'update', 'replace' ],
          overwrite: true,
          failOnWarning: false,
          keepNull: true
        }
      ];

      let c11_actual_modification = c11.properties({ computedValues: [{ "name": "cv_field", "expression": "RETURN CONCAT(@doc._key, ' ', @doc._id, ' ', @doc._rev)", "overwrite": true }] });

      checkComValProperties(c[10], c11_exp_modification, c11_actual_modification.computedValues);

      //for c12_overwriteTrue comVal
      let c12_exp_modification = [
        {
          name: 'cv_field',
          expression: "RETURN [{from_doc: CONCAT(@doc.name, ' ', @doc.field), system:{_key: @doc._key, _rev: @doc._rev, _id: @doc._id}, values: [RANGE(1, 10)]}]",
          computeOn: [ 'insert', 'update', 'replace' ],
          overwrite: true,
          failOnWarning: false,
          keepNull: true
        }
      ];

      let c12_actual_modification = c12.properties({ computedValues: [{ "name": "cv_field", "expression": "RETURN [{from_doc: CONCAT(@doc.name, ' ', @doc.field), system:{_key: @doc._key, _rev: @doc._rev, _id: @doc._id}, values: [RANGE(1, 10)]}]", "overwrite": true }] });

      checkComValProperties(c[11], c12_exp_modification, c12_actual_modification.computedValues);

      //-------------------------------------------------------x-------------------------------------------------------------

      c1.ensureIndex({"type":"inverted","name":"inverted","fields":[{"name":"cv_field"}]});
       
      c1.ensureIndex({"type":"persistent","name":"persistent","fields":["cv_field"], "sparse": true});  

      c2.ensureIndex({"type":"inverted","name":"inverted","fields":[{"name":"cv_field"}]});
       
      c2.ensureIndex({"type":"persistent","name":"persistent","fields":["cv_field"], "sparse": true});  

      c3.ensureIndex({"type":"inverted","name":"inverted","fields":[{"name": "cv_field_insert"}]});
       
      c3.ensureIndex({"type":"persistent","name":"persistent","fields":["cv_field_insert"], "sparse": true});  

      c4.ensureIndex({"type":"inverted","name":"inverted","fields":[{"name":"cv_field_update"}]});
       
      c4.ensureIndex({"type":"persistent","name":"persistent","fields":["cv_field_update"], "sparse": true});  

      c5.ensureIndex({"type":"inverted","name":"inverted","fields":[{"name":"cv_field_replace"}]});
       
      c5.ensureIndex({"type":"persistent","name":"persistent","fields":["cv_field_replace"], "sparse": true});  

      c6.ensureIndex({"type":"inverted","name":"inverted","fields":[{"name":"cv_field"}]});
       
      c6.ensureIndex({"type":"persistent","name":"persistent","fields":["cv_field"], "sparse": true});  

      c7.ensureIndex({"type":"inverted","name":"inverted","fields":[{"name":"cv_field"}]});
       
      c7.ensureIndex({"type":"persistent","name":"persistent","fields":["cv_field"], "sparse": true});  

      c8.ensureIndex({"type":"inverted","name":"inverted","fields":[{"name":"cv_field"}]});
       
      c8.ensureIndex({"type":"persistent","name":"persistent","fields":["cv_field"], "sparse": true});  

      c9.ensureIndex({"type":"inverted","name":"inverted","fields":[{"name":"cv_field"}]});
       
      c9.ensureIndex({"type":"persistent","name":"persistent","fields":["cv_field"], "sparse": true});  

      c10.ensureIndex({"type":"inverted","name":"inverted","fields":[{"name":"cv_field1"},{"name":"cv_field2"},{"name":"cv_field3"}]});
       
      c10.ensureIndex({"type":"persistent","name":"persistent","fields":["cv_field1", "cv_field2", "cv_field3"], "sparse": true});

      c11.ensureIndex({"type":"inverted","name":"inverted","fields":[{"name":"cv_field"}]});
       
      c11.ensureIndex({"type":"persistent","name":"persistent","fields":["cv_field"], "sparse": true});

      c12.ensureIndex({"type":"inverted","name":"inverted","fields":[{"name":"cv_field", "nested": ["from_doc"]}]});
      
      //-------------------------------------------------------x-------------------------------------------------------------
      
      // creating views for the collections
      print("060: Creating computed values views with sample collections");
      
      // get all the view's variable name from the variable_name_declaration method globally
      let view = views_name_declaration(dbCount);
      
      db._createView(view[0], "arangosearch");

      let creationOutput  = db[view[0]].properties(
        {"links":{
          [[c[0]]]:{"fields": {"cv_field": {}},"includeAllFields":true},
          [[c[1]]]:{"fields": {"cv_field": {}},"includeAllFields":true},
          [[c[2]]]:{"fields": {"cv_field": {}},"includeAllFields":true},
          [[c[3]]]:{"fields": {"cv_field": {}},"includeAllFields":true},
          [[c[4]]]:{"fields": {"cv_field": {}},"includeAllFields":true},
          [[c[5]]]:{"fields": {"cv_field": {}},"includeAllFields":true},
          [[c[6]]]:{"fields": {"cv_field": {}},"includeAllFields":true},
          [[c[7]]]:{"fields": {"cv_field": {}},"includeAllFields":true},
          [[c[8]]]:{"fields": {"cv_field": {}},"includeAllFields":true},
          [[c[9]]]:{"fields": {"cv_field": {}},"includeAllFields":true},
          [[c[10]]]:{"fields": {"cv_field": {}},"includeAllFields":true},
          [[c[11]]]:{"fields": {"cv_field": {}},"includeAllFields":true}
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
          [c[0]] : {
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
          [c[1]] : {
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
          [c[2]] : {
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
          [c[3]] : {
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
          [c[4]] : {
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
          [c[5]] : {
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
          [c[6]] : {
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
          [c[7]] : {
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
          [c[8]] : {
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
          [c[9]] : {
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
          [c[10]] : {
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
          [c[11]] : {
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
      }

      // this method will compare two outputs
      checkComValProperties(`${view[0]}`, creationOutput, expected_output);

      // creating testviewV2 allias
      db._createView(view[1], "search-alias", {
        "indexes": [
          {
            'collection': c[0],
            'index': 'inverted'
          },
          {
            'collection': c[1],
            'index': 'inverted'
          },
          {
            'collection': c[2],
            'index': 'inverted'
          },
          {
            'collection': c[3],
            'index': 'inverted'
          },
          {
            'collection': c[4],
            'index': 'inverted'
          },
          {
            'collection': c[5],
            'index': 'inverted'
          },
          {
            'collection': c[6],
            'index': 'inverted'
          },
          {
            'collection': c[7],
            'index': 'inverted'
          },
          {
            'collection': c[8],
            'index': 'inverted'
          },
          {
            'collection': c[9],
            'index': 'inverted'
          },
          {
            'collection': c[10],
            'index': 'inverted'
          },
          {
            'collection': c[11],
            'index': 'inverted'
          }
        ]
      })
        

      //-------------------------------------------------------x-------------------------------------------------------------
      //inserting data to all collection
      let data_array = [c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12];
      let docsAsStr = fs.read(`${PWD}/makedata_suites/060_computed_value.json`);

      // this function will read and insert and check all the neccessary data for the respective collection
      data_array.forEach(col => {
        col.save(JSON.parse(docsAsStr), { silent: true });

        //this cmd will find one docs from the collection
        let has_cv_field = col.all().toArray();
        // checking computed value field exit on the collection's doc
        if (col === c1 || col === c2 || col === c7 || col === c8 || col === c9 || col === c11 || col === c12) {
          if (!has_cv_field.some(obj => obj.hasOwnProperty("cv_field"))) {
            throw new Error(`060: Computed value field 'cv_field' missing from collection ${col.name}`);
          }
        }
        else if (col === c3) {
          if (!has_cv_field.some(obj => obj.hasOwnProperty("cv_field_insert"))) {
            throw new Error(`060: Computed value field 'cv_field' missing from collection ${col.name}`);
          }
        }
        else if (col === c4 || col === c5) {
          if (!has_cv_field.some(obj => obj.hasOwnProperty("cv_field"))) {
            throw new Error(`060: Computed value field 'cv_field' missing from collection ${col.name}`);
          }
        }
        // else if (col === c6) {
        //   if (!has_cv_field.some(obj => obj.hasOwnProperty("cv_field"))) {
        //     throw new Error(`060: Computed value field 'cv_field' missing from collection ${col.name}`);
        //   }
        // } 
        else if (col === c10) {
          if (!has_cv_field.some(obj => obj.hasOwnProperty("cv_field"))) {
            throw new Error(`060: Computed value field 'cv_field' missing from collection ${col.name}`);
          }
        }
      });

      //execute queries which use views and verify that the proper amount of docs are returned
      let index_tuple = index_array(dbCount);
      result_comparision(db, index_tuple);

      //execute queries which use views and verify that the proper amount of docs are returned
      let viewTuple = views_array(dbCount);
      result_comparision(db, viewTuple);

      return 0;
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      print(`060: checking data ${dbCount}`);
      //execute queries which use views and verify that the proper amount of docs are returned
      let index_tuple = index_array(dbCount);
      result_comparision(db, index_tuple);

      //execute queries which use views and verify that the proper amount of docs are returned
      let viewTuple = views_array(dbCount);
      result_comparision(db, viewTuple);

      return 0;
    },
    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`060: clearing data ${dbCount}`);

      // get all the view's variable name from the variable_name_declaration method globally
      let view = views_name_declaration(dbCount);

      try {
        db._dropView(`${view[0]}`);
        db._dropView(`${view[1]}`);
      } catch (error) {
        console.log('060: Deleting view failed with :', error.message);
        throw error;
      }
      progress("060: deleted views");

      // getting all the collection name with dbcount
      let c = collection_declaration(dbCount);
      c.forEach(col => {
        db[col].properties({computedValues: []})
        //checking the properties set to null properly
        if (db[col].properties()["computedValues"] == null) {
          //drop the collection after check
          db._drop(col);
          progress(`060: deleting ${col} collection`);
        } else {
          throw new Error(`060: ${col} deletion failed!`);
        }
      })
      
      return 0;
    }
  };

}());
