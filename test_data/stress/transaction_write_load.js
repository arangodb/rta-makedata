/* global ARGUMENTS, print */
const fs = require('fs');

const _ = require('lodash');
const arangodb = require('@arangodb');
const db = arangodb.db;
const internal = require("internal");
const sleep = internal.sleep;
let PWDRE = /.*at (.*)transaction_write_load.js.*/;
let stack = new Error().stack;
let PWD = fs.makeAbsolute(PWDRE.exec(stack)[1]);

let {
  options,
  setOptions,
  createCollectionSafe,
  createSafe,
  progress,
  getShardCount,
  getReplicationFactor,
  writeGraphData } = require(fs.join(PWD, "..", "common"));

let args = _.clone(ARGUMENTS);

let opts = internal.parseArgv(args, 0);
setOptions(opts);

let c =createCollectionSafe(`transaction_${opts.count}`, 3, 1);
sleep(10);
console.log('nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn');
let count = 0;
while (count < 100000) {
  let trx = db._createTransaction({
    collections: { write: c.name() }
  });
  let tc = trx.collection(c.name());
  tc.insert({ _key: `test1_${count}`, value: 1 });
  tc.insert([{ _key: 'test2_${count}', value: 2 }, { _key: 'test3', value: 3 }]);
  

  trx.commit();

  internal.sleep(0.1);
  count += 1;
  print(`${opts.count} - ${count}.`);
}
print(`DONE! ${options.count}`);
