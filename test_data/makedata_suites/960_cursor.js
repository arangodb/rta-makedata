/* global print, assertTrue, assertFalse, assertEqual, db, semver, download, sleep, fs, arango, PWD */

class testCursor {
  constructor(query, bindvars, batchSize) {
    this.cursorId = null;
    this.nextBatchId = null;
    this.currentBatchId = null;
    this.query = query;
    this.bindvars = bindvars;
    this.resultChunks = {};
    this.hasMore = true;
    this.batchSize = batchSize;
  }
  compressDocuments(docs) {
    let ret = [];
    docs.forEach(doc => { ret.push(doc._key);});
    return ret;
  }
  runQuery() {
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
    if (this.cursorId === undefined) {
      throw new Error("failed to create a query with cursor: " + JSON.stringify(ret));
    }
    this.nextBatchId = ret.parsedBody['nextBatchId'];
    return this.hasMore;
  }
  getNext() {
    let url = `/_api/cursor/${this.cursorId}/${this.nextBatchId}`;
    let ret = arango.POST_RAW(url, "");
    //print(ret)
    if (ret.code !== 200) {
      throw new Error(`Cursor could not be read from ${url} : ${JSON.stringify(ret)}`);
    }
    this.currentBatchId = this.nextBatchId;
    this.resultChunks[this.currentBatchId] = this.compressDocuments(ret.parsedBody.result);
    this.nextBatchId = ret.parsedBody['nextBatchId'];
    this.hasMore = ret.parsedBody.hasMore;
    return this.hasMore;
  }

  getLast() {
    let url = `/_api/cursor/${this.cursorId}/${this.currentBatchId}`;
    let ret = arango.POST_RAW(url, "");
    //print(ret)
    if (ret.code !== 200) {
      throw new Error(`Cursor could not be read from ${url}: ${JSON.stringify(ret)}`);
    }
    this.nextBatchId = ret.parsedBody['nextBatchId'];
    this.hasMore = ret.parsedBody.hasMore;
    let reGotChunk = this.compressDocuments(ret.parsedBody.result);
    if (!_.isEqual(this.resultChunks[this.currentBatchId], reGotChunk)) {
      print(this.resultChunks)
      print(this.currentBatchId)
      print(this.resultChunks[this.currentBatchId])
      print(reGotChunk)
      throw new Error("Chunks weren't as expected: " + url);
    }
    this.currentBatchId = this.nextBatchId;
    this.resultChunks[this.currentBatchId] = reGotChunk;
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
      // check per DB
      let cursors = [];
      try {
        let i=0;
        for (; i < 10; i++) {
          let collName = `citations_naive_${dbCount}`;
          cursors[i] = new testCursor("FOR k IN @@coll RETURN k",
                                      {
                                        "@coll": collName
                                      },
                                     i+2);
          
          if (! cursors[i].runQuery()) {
          }
        }
        for (; i < 20; i++) {
          let viewName = `test_view2_${dbCount}`;
          cursors[i] = new testCursor("for doc in @@view search doc.cv_field == SOUNDEX('sky') return doc",
                                      {
                                        "@view": viewName
                                      },
                                     i-8);
          
          if (! cursors[i].runQuery()) {
          }
        }
        if (isEnterprise) {
          for (;i < 30; i++) {
            let collName = `citations_smart_${dbCount}`;
            cursors[i] = new testCursor("FOR k IN @@coll RETURN k",
                                        {
                                          "@coll": collName
                                        },
                                        i-18);
            
            if (! cursors[i].runQuery()) {
            }
          }
        }
        while (cursors.length > 0) {
          // print(cursors.length)
          let c = Math.floor(Math.random() * cursors.length)
          //print('c: ' + c)
          cursors[c].getLast();
          if (!cursors[c].getNext()) {
            print('regetting last')
            cursors[c].getLast();
            print('done with ' + c);
            cursors = cursors.splice(c + 1, 1);
          }
        }
      } catch (ex) {
        print(ex);
        print(ex.stack);
        throw ex;
      }
      return 0;
    },
  };

}());
