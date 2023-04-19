/* global print, assertTrue, assertFalse, assertEqual, db, semver, download, sleep, fs, arango, PWD */

const jsunity = require('jsunity');

class testCursor {
  constructor(query, bindvars) {
    this.cursorId = null;
    this.nextBatchId = null;
    this.currentBatchId = null;
    this.query = query;
    this.bindvars = bindvars;
    this.resultChunks = {};
    this.hasMore = true;
    this.batchSize = 2;
  }
  compressDocuments(docs) {
    let ret = [];
    docs.forEach(doc => { ret.push(doc._key);});
    return ret;
  }
  runQuery() {
    // print(db._collections())
    //print(this.query)
    let ret = arango.POST_RAW('/_api/cursor', {
      "query": this.query,
      "batchSize": this.batchSize,
      "bindVars": this.bindvars,
      "options": {"stream": false, "allowRetry": true}
    });
    //print(ret)
    if (ret.code !== 201) {
      throw new Error(`Cursor could not be created: ${JSON.stringify(ret)}`);
    }
    this.hasMore = ret.parsedBody.hasMore;
    this.currentBatchId = 1;
    this.resultChunks[this.currentBatchId] = this.compressDocuments(ret.parsedBody.result);
    this.cursorId = ret.parsedBody['id'];
    //assertTrue(ret.parsedBody['hasMore'], ret) 
    this.nextBatchId = ret.parsedBody['nextBatchId'];
    // print(this.resultChunks)
    return this.hasMore;
  }
  getNext() {
    //print('zzzzz')
    // 
    let ret = arango.POST_RAW(`/_api/cursor/${this.cursorId}/${this.nextBatchId}`, "");
    //print(ret)
    if (ret.code !== 200) {
      throw new Error(`Cursor could not be read: ${JSON.stringify(ret)}`);
    }
    this.currentBatchId = this.nextBatchId;
    //print(this.resultChunks)
    this.resultChunks[this.currentBatchId] = this.compressDocuments(ret.parsedBody.result);
    this.nextBatchId = ret.parsedBody['nextBatchId'];
    // print(this.resultChunks)
    this.hasMore = ret.parsedBody.hasMore;
    return this.hasMore;
  }

  getLast() {
    let ret = arango.POST_RAW(`/_api/cursor/${this.cursorId}/${this.currentBatchId}`, "");
    //print(ret)
    if (ret.code !== 200) {
      throw new Error(`Cursor could not be read: ${JSON.stringify(ret)}`);
    }
    this.nextBatchId = ret.parsedBody['nextBatchId'];
    this.hasMore = ret.parsedBody.hasMore;
    let reGotChunk = this.compressDocuments(ret.parsedBody.result);
    if (!_.isEqual(this.resultChunks[this.currentBatchId], reGotChunk)) {
      print(this.resultChunks)
      print(this.currentBatchId)
      print(this.resultChunks[this.currentBatchId])
      print(reGotChunk)
      throw new Error("Chunks weren't as expected!");
    }
    this.currentBatchId = this.nextBatchId;
    this.resultChunks[this.currentBatchId] = reGotChunk;
    // print(this.resultChunks)
    return this.hasMore;
  }
};


(function () {
  return {
    isSupported: function (version, oldVersion, options, enterprise, cluster) {
      if (oldVersion === "") {
        oldVersion = version;
      }
      let old = semver.parse(semver.coerce(oldVersion));
      return semver.gte(old, "3.11.0");
    },

    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      let collName = `citations_naive_${dbCount}`;
      // check per DB
      let cursors = [];
      for (let i=0; i < 10; i++) {
        cursors[i] = new testCursor("FOR k IN @@coll RETURN k",
                              {
                                "@coll": collName
                              });
        
        if (! cursors[i].runQuery()) {
        }
      }
      while (cursors.length > 0) {
        print(cursors.length)
        let c = Math.floor(Math.random() * cursors.length)
        print('c: ' + c)
        cursors[c].getLast();
        if (!cursors[c].getNext()) {
          print('regetting last')
          cursors[c].getLast();
          print('done with ' + c);
          cursors = cursors.splice(c, 1)
        }
        
      }
      return 0;
    },
  };

}());
