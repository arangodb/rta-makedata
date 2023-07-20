/* global ARGUMENTS, print */

const _ = require('lodash');
const arangodb = require('@arangodb');
const db = arangodb.db;
const internal = require("internal");

let args = _.clone(ARGUMENTS);

let options = internal.parseArgv(args, 0);

print('nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn');
let c = db._create(`transaction_${options.count}`, {numberOfShards: 2});

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
  print('.');
}
