/* global print, assertTrue, assertFalse, assertEqual, db, semver, download, sleep, fs, arango, PWD, _ */

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
    let postData = {
      "query": this.query,
      "batchSize": this.batchSize,
      "bindVars": this.bindvars,
      "options": {"stream": false, "allowRetry": true}
    };
    let ret = arango.POST_RAW('/_api/cursor', postData);
    //progress(ret)
    if (ret.code !== 201) {
      throw new Error(`960: Cursor for query '${this.query}' could not be created: ${JSON.stringify(ret)}`);
    }
    this.hasMore = ret.parsedBody.hasMore;
    this.currentBatchId = 1;
    this.resultChunks[this.currentBatchId] = this.compressDocuments(ret.parsedBody.result);
    this.cursorId = ret.parsedBody['id'];
    if (!this.hasMore) {
      throw new Error(`960: failed to create the query '${JSON.stringify(postData)}' with cursor: ${JSON.stringify(ret)}`);
    }
    if (this.cursorId === undefined) {
      throw new Error(`960: failed to create the query '${JSON.stringify(postData)}' with cursor: ${JSON.stringify(ret)}`);
    }
    this.nextBatchId = ret.parsedBody['nextBatchId'];
    return this.hasMore;
  }
  getNext() {
    let url = `/_api/cursor/${this.cursorId}/${this.nextBatchId}`;
    let ret = arango.POST_RAW(url, "");
    //progress(ret)
    if (ret.code !== 200) {
      throw new Error(`960: Cursor could not be read from ${url} : ${JSON.stringify(ret)}`);
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
    //progress(ret)
    if (ret.code !== 200) {
      throw new Error(`960: Cursor could not be read from ${url}: ${JSON.stringify(ret)}`);
    }
    this.nextBatchId = ret.parsedBody['nextBatchId'];
    this.hasMore = ret.parsedBody.hasMore;
    let reGotChunk = this.compressDocuments(ret.parsedBody.result);
    if (!_.isEqual(this.resultChunks[this.currentBatchId], reGotChunk)) {
      progress(this.resultChunks);
      progress(this.currentBatchId);
      progress(this.resultChunks[this.currentBatchId]);
      progress(reGotChunk);
      throw new Error("960: Chunks weren't as expected: " + url);
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
      return semver.gte(old, "3.11.0") && !options.bigDoc;
    },

    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      // check per DB
      let cursors = [];
      try {
        let i=0;
        for (; i < 10; i++) {
          let collName = `citations_naive_${dbCount}`;
          let cur = new testCursor("FOR k IN @@coll RETURN k",
                                   {
                                     "@coll": collName
                                   },
                                   i+2);

          if (cur.runQuery()) {
            cursors.push(cur);
          }
        }

        let offset = 8;
        if (isEnterprise) {
          let viewName = `view2_101_${dbCount}`;
          let filteredViews = db._views().filter(view => view.name() === viewName);
          if (filteredViews.length > 0) {
            for (; i < 20; i++) {
              let cur = new testCursor("for doc in @@view search doc.cv_field == SOUNDEX('sky') OPTIONS { waitForSync: true } return doc",
                                       {
                                         "@view": viewName
                                       },
                                       i - offset);

              if (cur.runQuery()) {
                cursors.push(cur);
              }
            }
            offset += 10;
          }
          if (isCluster) {
            for (;i < 30; i++) {
              let collName = `citations_smart_${dbCount}`;
              let cur = new testCursor("FOR k IN @@coll RETURN k",
                                       {
                                         "@coll": collName
                                       },
                                       i - offset);

              if (cur.runQuery()) {
                cursors.push(cur);
              }
            }
          }
        }
        while (cursors.length > 0) {
          // progress(cursors.length)
          let c = Math.floor(Math.random() * cursors.length);
          //progress('c: ' + c)
          cursors[c].getLast();
          if (!cursors[c].getNext()) {
            progress('960: regetting last');
            cursors[c].getLast();
            progress('960: done with ' + c);
            let tail = cursors.splice(c + 1, cursors.length);
            cursors = cursors.splice(0, c).concat(tail);
          }
        }
      } catch (ex) {
        progress(ex);
        progress(ex.stack);
        throw ex;
      }
      return 0;
    },
  };

}());
