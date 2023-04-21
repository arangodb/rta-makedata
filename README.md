# makedata / checkdata framework
Makedata is ran inside arangosh. It was made to be user-expandeable by hooking in on test cases.
It consists of these files in test_data:
 - `makedata.js` - initially generate test data
 - `checkdata.js` - check whether data is available; could be read-only
 - `cleardata.js` - remove the testdata - after invoking it makedata should be able to be ran again without issues.
 - Plugins in `test_data/makedata_suites` executed in alphanumeric order:
   - `000_dummy.js` - this can be used as a template if you want to create a new plugin. 
   - `010_disabled_uuid_check.js` If you're running a cluster setup in failover mode, this checks and waits for all shards have an available leader.
   - `020_foxx.js` Installs foxx, checks it. 
   - `050_database.js` creates databases for the test data.
   - `100_collections.js` creates a set of collections / indices
   - `400_views.js` creates some views
   - `402_views.js` create views and links with 'cache' properties. It checks proper normalization, memory usage and presence of cached columns after updates. This feature was introduced in 3.9.5
   - `500_community_graph.js` creates a community patent graph
   - `550_smart_graph.js` creates a smart patent graph
   - `560_smartgraph_edge_validator.js` on top of the enterprise graph, this will check the integrity check of the server.
   - `561_smartgraph_vertex_validator.js` on top of the enterprise graph, this will check the integrity check of the server.
   - `570_enterprise_graph.js` creates an enterprise patent graph
   - `900_oneshard.js` creates oneshard database and does stuff with it.
   - `607_analyzers.js` creates suported analyzers for 3.7.x version and check it's functionality.
      Added Analyzers: (documentation link: https://www.arangodb.com/docs/3.7/analyzers.html)
      - identity: An Analyzer applying the identity transformation, i.e. returning the input unmodified.
      - delimiter: An Analyzer capable of breaking up delimited text into tokens as per RFC 4180 (without starting new  records on newlines).
      - stem : An Analyzer capable of stemming the text, treated as a single token, for supported languages.
      - norm Upper : An Analyzer capable of normalizing the text, treated as a single token, i.e. case conversion and accent removal. This one will Convert input string to all upper-case characters.
      - norm Accent : This analyzer is capable of convert accented characters to their base characters.
      - ngram : An Analyzer capable of producing n-grams from a specified input in a range of min..max (inclusive). Can optionally preserve the original input.
      - n-Bigram Markers: This analyzer is a bigram Analyzer with preserveOriginal enabled and with start and stop markers.
      - text : An Analyzer capable of breaking up strings into individual words while also optionally filtering out stop-words, extracting word stems, applying case conversion and accent removal.
      - text Edge ngram: This analyzer is a custom text Analyzer with the edge n-grams feature and normalization enabled, stemming disabled and "the" defined as stop-word to exclude it.
   - `608_analyzers.js` creates suported analyzers for 3.8.x version and check it's functionality.
      Added Analyzers: (documentation link: https://www.arangodb.com/docs/3.8/analyzers.html)
      - Soundex: Analyzer for a phonetically similar term search.
      - aqlConcat: Concatenating Analyzer for conditionally adding a custom prefix or suffix.
      - aqlFilter: Filtering Analyzer that discards unwanted data based on the prefix.
      - nGramPipeline: Normalize to all uppercase and compute bigrams.
      - delimiterPipeline: Split at delimiting characters , and ;, then stem the tokens.
      - stopwords: Create and use a stopword Analyzer that removes the tokens `and` and `the`
      - stopwordsPipeline: An Analyzer capable of removing specified tokens from the input.
      - geoJson: An Analyzer capable of breaking up a GeoJSON object into a set of indexable tokens for further usage with ArangoSearch Geo functions.
      - geoPoint: An Analyzer capable of breaking up JSON object describing a coordinate into a set of indexable tokens for further usage with ArangoSearch Geo functions.
   - `609_analyzers.js` creates suported analyzers for 3.9.x version and check it's functionality.
      - Collation: An Analyzer capable of breaking up the input text into tokens in a language-agnostic manner as per Unicode  Standard Annex #29.
      - Segmentation: Analyzers to show the behavior of the different break options such as 'all', 'alpha' and  'graphic'.
   - `610_analyzers.js` creates suported analyzers for 3.10.x version and check it's functionality.
      - classifierSingle: An Analyzer capable of classifying tokens in the input text.
      - classifierDouble: An Analyzer capable of classifying tokens in the input text.
      - nearestNeighborsSingle: An Analyzer capable of finding nearest neighbors of single tokens in the input.
      - nearestNeighborsDouble: An Analyzer capable of finding nearest neighbors of double tokens in the input.

It should be considered to provide a set of hooks (000_dummy.js can be considered being a template for this):

- Hook to check whether the environment will support your usecase [single/cluster deployment, Community/Enterprise, versions in test]
- Per Database loop Create / Check [readonly] / Delete handler
- Per Collection loop Create / Check [readonly] / Delete handler

The hook functions should respect their counter parameters, and use them in their respective reseource names.
Jslint should be used to check code validity.

The list of the hooks enabled for this very run of one of the tools is printed on startup for reference.

Makedata should be considered a framework for consistency checking in the following situations:
 - replication
 - hot backup
 - upgrade
 - dc2dc

The replication fuzzing test should be used to ensure the above with randomness added.

Makedata is by default ran with one dataset. However, it can also be used as load generator. 
For this case especialy, the counters have to be respected, so subsequent runs don't clash with earlier runs.
The provided dbCount / loopCount should be used in identifiers to ensure this.

To Aid development, the makedata framework can be launched from within the arangodb unittests, 
if this repository is checked out next to it:

``` bash
./scripts/unittest rta_makedata --extremeVerbosity true --cluster true --makedata_args:bigDoc true
```

If you want to filter for the scripts you can specify a coma separated list:
``` bash
./scripts/unittest rta_makedata --extremeVerbosity true --cluster true --makedata_args:bigDoc true --test '010,020,050'
```

# test output
It should be obvious whether a test is run in a scenario or not. Hence the list of executed tests is output:

```
[DL]   .../000_dummy.js
[ ]    .../010_disabled_uuid_check.js
[ ]    .../015_cluster_wait.js
[D]    .../020_foxx.js
[D]    .../050_database.js
[D]    .../051_database_extended_names.js
[D]    .../060_computed_values.js
[L]    .../100_collections.js
[L]    .../400_views.js
[L]    .../401_views.js
[L]    .../402_views.js
[L]    .../500_community_graph.js
[L]    .../550_smart_graph.js
[ ]    .../560_smartgraph_edge_validator.js
[ ]    .../561_smartgraph_vertex_validator.js
[D]    .../570_enterprise_graph.js
[D]    .../607_analyzers.js
[D]    .../608_analyzers.js
[D]    .../609_analyzers.js
[D]    .../610_analyzers.js
[D]    .../900_oneshard.js
[ ]    .../950_read_from_follower.js
[]     .../960_cursor.js
```
with the following meanings:
- `[ ]`: this test is not applicable for the current environment and will be skipped
- `[D]`: This test has database level functionality
- `[L]`: This test has loop-level functionality
- `[LD`: This test has both.


# Embeddings
RTA Makedata is embedded into [arangodb](https://github.com/arangodb/arangodb) and [RTA](https://github.com/arangodb/release-test-automation); 
Hence a PR on RTA Makedata has to be sidelined by two PRs.
