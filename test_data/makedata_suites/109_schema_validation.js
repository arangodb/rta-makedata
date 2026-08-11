/* global print, progress, db, createCollectionSafe, createSafe, getShardCount, getReplicationFactor, semver, _ */

// Makes sure that collection level JSON schema validation survives the
// scenarios the makedata framework is built for (replication, hot backup,
// upgrade and dc2dc): the schema definition has to be preserved and the
// validator has to keep rejecting documents that do not match the schema.
// Tests named graph api gharial as well.

(function () {
  const arangodb = require("@arangodb");
  const ERRORS = arangodb.errors;
  const generalGraph = require("@arangodb/general-graph");

  const documentSchema = {
    "level": "strict",
    "type": "json",
    "rule": {
      "type": "object",
      "properties": {
        "numArray": {
          "type": "array",
          "items": {
            "type": "number",
            "maximum": 6
          }
        },
        "name": {
          "type": "string",
          "minLength": 4,
          "maxLength": 10
        },
        "number": {
          "type": "number",
          "items": {
            "minimum": 1000000
          }
        }
      },
      "additionalProperties": false
    },
    "message": "Schema validation failed"
  };

  const validDoc = {"numArray": [1, 2, 3, 4]};
  const invalidDoc = {"numArray": "1, 2, 3, 4"};
  const skipOptions = {"skipDocumentValidation": true};

  const edgeSchema = {
    "level": "strict",
    "rule": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string"
        }
      },
      "additionalProperties": false
    },
    "message": "Schema validation failed"
  };

  const blankEdge = {
    "_from": "vert/A",
    "_to": "vert/B"
  };
  const validEdge = {
    ...blankEdge,
    "name": "Helge"
  };
  const invalidEdge = {
    ...blankEdge,
    "additional": true
  };

  // Name helpers.
  const docColName = (dbCount) => `schema_validation_${dbCount}`;
  const edgeColName = (dbCount) => `schema_validation_edge_${dbCount}`;
  const graphName = (dbCount) => `schema_validation_graph_${dbCount}`;
  const graphVertexColName = (dbCount) => `schema_validation_vertex_${dbCount}`;
  const graphEdgeColName = (dbCount) => `schema_validation_relation_${dbCount}`;

  // Compares the schema stored in the collection properties with the schema we expected to have created.
  let assertSchemaMatches = function (colName, actualSchema, expectedSchema) {
    if (actualSchema === null || actualSchema === undefined) {
      throw new Error(`109: collection ${colName}: schema validator is missing!`);
    }
    if (actualSchema.level !== expectedSchema.level) {
      throw new Error(`109: collection ${colName}: expected schema level ${expectedSchema.level} but got ${actualSchema.level}`);
    }
    if (actualSchema.message !== expectedSchema.message) {
      throw new Error(`109: collection ${colName}: expected schema message '${expectedSchema.message}' but got '${actualSchema.message}'`);
    }
    if (!_.isEqual(actualSchema.rule, expectedSchema.rule)) {
      throw new Error(`109: collection ${colName}: schema rule does not match! got ${JSON.stringify(actualSchema.rule)} expected ${JSON.stringify(expectedSchema.rule)}`);
    }
  };

  // Verifies that inserting an invalid document is rejected by the validator.
  let assertInsertRejected = function (collection, doc) {
    try {
      collection.insert(doc);
      throw new Error(`109: collection ${collection.name()}: validator did not reject invalid document ${JSON.stringify(doc)}`);
    } catch (err) {
      if (err.errorNum !== ERRORS.ERROR_VALIDATION_FAILED.code) {
        throw err;
      }
    }
  };

  // Runs the given named graph operation and expects it to be rejected by the schema validator (ERROR_VALIDATION_FAILED).
  let assertGraphOperationRejected = function (description, operation) {
    try {
      operation();
      throw new Error(`109: named graph operation '${description}' should have been rejected by the validator`);
    } catch (err) {
      if (err.errorNum !== ERRORS.ERROR_VALIDATION_FAILED.code) {
        throw err;
      }
    }
  };

  return {
    isSupported: function (version, oldVersion, options, enterprise, cluster) {
      // Collection level JSON schema validation was introduced in 3.7.0.
      let versionSemver = semver.parse(semver.coerce(version));
      return semver.gte(versionSemver, "3.7.0");
    },

    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} 109: making schema validation data ${dbCount}`);

      // Create a document collection with a strict JSON schema.
      let docCol = createCollectionSafe(docColName(dbCount), 3, 2, {schema: documentSchema});
      progress('109: createSchemaDocumentCollection');
      // A valid document must be accepted, an invalid one must be rejected.
      docCol.insert(validDoc);
      progress('109: insertValidDoc');

      // Create an edge collection with a strict JSON schema.
      createSafe(edgeColName(dbCount),
        name => {
          return db._createEdgeCollection(name, {
            schema: edgeSchema,
            numberOfShards: getShardCount(3),
            replicationFactor: getReplicationFactor(2)
          });
        }, name => {
          return db._collection(name);
        });
      progress('109: createSchemaEdgeCollection');
      let edgeCol = db._collection(edgeColName(dbCount));
      edgeCol.insert(validEdge);
      progress('109: insertValidEdge');

      // Create a named graph whose vertex and edge collections carry the same JSON schema.
      createCollectionSafe(graphVertexColName(dbCount), 3, 2, {schema: documentSchema});
      progress('109: createSchemaGraphVertexCollection');
      createSafe(graphEdgeColName(dbCount),
        name => {
          return db._createEdgeCollection(name, {
            schema: edgeSchema,
            numberOfShards: getShardCount(3),
            replicationFactor: getReplicationFactor(2)
          });
        }, name => {
          return db._collection(name);
        });
      progress('109: createSchemaGraphEdgeCollection');
      createSafe(graphName(dbCount),
        gn => {
          return generalGraph._create(gn,
            [generalGraph._relation(graphEdgeColName(dbCount),
              [graphVertexColName(dbCount)],
              [graphVertexColName(dbCount)])],
            [],
            {
              replicationFactor: getReplicationFactor(2),
              numberOfShards: getShardCount(3)
            });
        }, gn => {
          return generalGraph._graph(gn);
        });
      progress('109: createSchemaGraph');

      // Insert two valid vertices and a valid edge through the named graph API.
      let graph = generalGraph._graph(graphName(dbCount));
      graph[graphVertexColName(dbCount)].save({...validDoc,
"_key": "A"});
      graph[graphVertexColName(dbCount)].save({...validDoc,
"_key": "B"});
      progress('109: insertValidGraphVertices');
      graph[graphEdgeColName(dbCount)].save({
        "_from": `${graphVertexColName(dbCount)}/A`,
        "_to": `${graphVertexColName(dbCount)}/B`,
        "_key": "edgeAB",
        "name": "Helge"
      });
      progress('109: insertValidGraphEdge');
    },

    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      print(`${Date()} 109: checking schema validation data ${dbCount}`);

      let docCol = db._collection(docColName(dbCount));
      if (docCol === null) {
        throw new Error(`109: collection ${docColName(dbCount)} is missing!`);
      }
      let edgeCol = db._collection(edgeColName(dbCount));
      if (edgeCol === null) {
        throw new Error(`109: collection ${edgeColName(dbCount)} is missing!`);
      }

      // The schema definition has to be preserved across the scenario.
      progress('109: checking schema properties');
      assertSchemaMatches(docColName(dbCount), docCol.properties().schema, documentSchema);
      assertSchemaMatches(edgeColName(dbCount), edgeCol.properties().schema, edgeSchema);

      // The AQL SCHEMA_GET function has to report the same schema.
      progress('109: checking SCHEMA_GET');
      let fetchedSchema = db._query(`RETURN SCHEMA_GET("${docColName(dbCount)}")`).toArray()[0];
      assertSchemaMatches(docColName(dbCount), fetchedSchema, documentSchema);

      // The AQL SCHEMA_VALIDATE function has to accept the valid document and reject the invalid one. These are read-only operations.
      progress('109: checking SCHEMA_VALIDATE');
      let responseValid = db._query(
        `RETURN SCHEMA_VALIDATE(@doc, @schema)`,
        {doc: validDoc, schema: documentSchema}).toArray()[0];
      if (responseValid === null || responseValid.valid !== true) {
        throw new Error(`109: SCHEMA_VALIDATE should have accepted the valid document: ${JSON.stringify(responseValid)}`);
      }
      let responseInvalid = db._query(
        `RETURN SCHEMA_VALIDATE(@doc, @schema)`,
        {doc: invalidDoc, schema: documentSchema}).toArray()[0];
      if (responseInvalid === null || responseInvalid.valid !== false) {
        throw new Error(`109: SCHEMA_VALIDATE should have rejected the invalid document: ${JSON.stringify(responseInvalid)}`);
      }
      if (responseInvalid.errorMessage !== documentSchema.message) {
        throw new Error(`109: SCHEMA_VALIDATE returned unexpected error message: ${JSON.stringify(responseInvalid)}`);
      }

      // The validator has to keep rejecting invalid documents. A rejected insert does not persist any data, hence this is safe for read-only.
      progress('109: checking validator rejects invalid documents');
      assertInsertRejected(docCol, invalidDoc);
      assertInsertRejected(edgeCol, invalidEdge);

      // The named graph collections have to keep their schema as well.
      progress('109: checking graph schema properties');
      let graphVertexCol = db._collection(graphVertexColName(dbCount));
      if (graphVertexCol === null) {
        throw new Error(`109: graph vertex collection ${graphVertexColName(dbCount)} is missing!`);
      }
      let graphEdgeCol = db._collection(graphEdgeColName(dbCount));
      if (graphEdgeCol === null) {
        throw new Error(`109: graph edge collection ${graphEdgeColName(dbCount)} is missing!`);
      }
      assertSchemaMatches(graphVertexColName(dbCount), graphVertexCol.properties().schema, documentSchema);
      assertSchemaMatches(graphEdgeColName(dbCount), graphEdgeCol.properties().schema, edgeSchema);

      // The named graph API has to enforce the same validator: saving an invalid vertex / edge through the graph must fail.
      progress('109: checking graph save rejects invalid documents');
      let graph = generalGraph._graph(graphName(dbCount));
      assertGraphOperationRejected('vertex.save(invalidDoc)', () => {
        graph[graphVertexColName(dbCount)].save(invalidDoc);
      });
      assertGraphOperationRejected('edge.save(invalidEdge)', () => {
        graph[graphEdgeColName(dbCount)].save({
          "_from": `${graphVertexColName(dbCount)}/A`,
          "_to": `${graphVertexColName(dbCount)}/B`,
          "additional": true
        });
      });
      // The existing valid vertices / edges also fail a replace with a invalid body.
      assertGraphOperationRejected('vertex.replace(invalidDoc)', () => {
        graph[graphVertexColName(dbCount)].replace(`${graphVertexColName(dbCount)}/A`, invalidDoc);
      });
      assertGraphOperationRejected('vertex.update(invalidDoc)', () => {
        graph[graphVertexColName(dbCount)].update(`${graphVertexColName(dbCount)}/A`, invalidDoc);
      });

      if (!readOnly) {
        // Additionally verify that valid documents are still accepted and that schema validation can be skipped.
        progress('109: checking validator accepts valid documents');
        docCol.insert(validDoc);
        edgeCol.insert(validEdge);
        // skipDocumentValidation must let an otherwise invalid document pass.
        docCol.insert(invalidDoc, skipOptions);
        edgeCol.insert(invalidEdge, skipOptions);

        // Exercise the full named graph manipulation API and make sure the validator is honoured throughout.
        progress('109: checking graph save / replace / update / remove');
        let vertexApi = graph[graphVertexColName(dbCount)];
        let edgeApi = graph[graphEdgeColName(dbCount)];

        // save accepts valid vertices and returns the new document.
        let vFrom = vertexApi.save(validDoc, {returnNew: true});
        let vTo = vertexApi.save(validDoc, {returnNew: true});
        // replace of a valid vertex with a valid body succeeds.
        vertexApi.replace(vFrom._id, {"name": "Linda"}, {returnOld: true,
returnNew: true});
        // update of a valid vertex with a valid body succeeds.
        vertexApi.update(vFrom._id, {"number": 5}, {returnOld: true,
returnNew: true});
        // skipDocumentValidation lets an otherwise invalid vertex pass.
        let vSkip = vertexApi.save(invalidDoc, skipOptions);

        // save accepts a valid edge between the two valid vertices.
        let edge = edgeApi.save({
          "_from": vFrom._id,
          "_to": vTo._id,
          "name": "Helge"
        }, {returnNew: true});
        // replace / update of a valid edge with a valid body succeeds.
        edgeApi.replace(edge._id, {"_from": vFrom._id,
"_to": vTo._id,
"name": "Ada"});
        edgeApi.update(edge._id, {"name": "Bob"});
        // A replace / update / save with an invalid body must be rejected.
        assertGraphOperationRejected('edge.replace(invalidEdge)', () => {
          edgeApi.replace(edge._id, {"_from": vFrom._id,
"_to": vTo._id,
"additional": true});
        });
        assertGraphOperationRejected('edge.update(invalidEdge)', () => {
          edgeApi.update(edge._id, {"additional": true});
        });
        // skipDocumentValidation lets an otherwise invalid edge pass.
        let edgeSkip = edgeApi.save({
          "_from": vFrom._id,
          "_to": vTo._id,
          "additional": true
        }, skipOptions);

        // remove has to clean up everything created above
        edgeApi.remove(edge._id);
        edgeApi.remove(edgeSkip._id);
        vertexApi.remove(vFrom._id);
        vertexApi.remove(vTo._id);
        vertexApi.remove(vSkip._id);

        // Removing a vertex through the named graph API has to cascade-remove all incident edges (see "Remove a Node" docs)
        progress('109: checking graph remove cascades to incident edges');
        let vCascadeFrom = vertexApi.save(validDoc);
        let vCascadeTo = vertexApi.save(validDoc);
        let cascadeEdge = edgeApi.save({
          "_from": vCascadeFrom._id,
          "_to": vCascadeTo._id,
          "name": "Cascade"
        });
        if (!db._exists(cascadeEdge._id)) {
          throw new Error(`109: named graph edge ${cascadeEdge._id} should exist after save`);
        }
        // remove of the source vertex must drop the connecting edge as well.
        let removedVertex = vertexApi.remove(vCascadeFrom._id, {returnOld: true});
        if (removedVertex === null || removedVertex === false) {
          throw new Error(`109: named graph vertex ${vCascadeFrom._id} should have been removed`);
        }
        if (db._exists(cascadeEdge._id)) {
          throw new Error(`109: removing vertex ${vCascadeFrom._id} did not cascade-remove its incident edge ${cascadeEdge._id}`);
        }
        // The unrelated vertex is still there and gets cleaned up explicitly.
        vertexApi.remove(vCascadeTo._id);
      }
      progress('109: done');
    },

    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} 109: clearing schema validation data ${dbCount}`);
      progress('109: drop schema_validation_graph');
      try {
        // Dropping the graph together with its collections also removes the schema-validated vertex / edge collections created above.
        generalGraph._drop(graphName(dbCount), true);
      } catch (e) {}
      progress('109: drop schema_validation_vertex');
      try {
        db._drop(graphVertexColName(dbCount));
      } catch (e) {}
      progress('109: drop schema_validation_relation');
      try {
        db._drop(graphEdgeColName(dbCount));
      } catch (e) {}
      progress('109: drop schema_validation');
      try {
        db._drop(docColName(dbCount));
      } catch (e) {}
      progress('109: drop schema_validation_edge');
      try {
        db._drop(edgeColName(dbCount));
      } catch (e) {}
      progress('109: drop done');
    }
  };
}());

