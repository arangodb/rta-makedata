/* global ARGUMENTS, print */
const fs = require('fs');

let PWDRE = /.*at (.*)views.js.*/;
let stack = new Error().stack;
let PWD = fs.makeAbsolute(PWDRE.exec(stack)[1]);

let {
  options,
  createSafe,
  createCollectionSafe,
  progress,
  getShardCount,
  getReplicationFactor,
  setOptions,
  writeGraphData } = require(fs.join(PWD, "..", "common"));

const _ = require('lodash');
const arangodb = require('@arangodb');
const db = arangodb.db;
const internal = require("internal");
const sleep = internal.sleep;
const time = internal.time;

let args = _.clone(ARGUMENTS);

let opts = internal.parseArgv(args, 0);
setOptions(opts);


let viewCollectionName = `stress_cview_${opts.count}`;
let cview = createCollectionSafe(viewCollectionName, 3, 1);
print('createView');
let viewName1 = `stress_view`;
let view1 = createSafe(viewName1,
                       viewname => {
                         return db._createView(viewname, "arangosearch", {});
                       }, viewname => {
                         return db._view(viewname);
                       }
                      );
print('createView2');
let meta = {
  links: {}
};
meta.links[viewCollectionName] = {
  includeAllFields: false,
  fields: {
    animal:{},
    name:{}
  }
};
view1.properties(meta);
sleep(10);
console.log('nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn');
let vertices = JSON.parse(fs.readFileSync(`${PWD}/../makedata_suites/500_550_570_vertices.json`));


let count = 0;
while (count < 100000) {
  vertices.forEach(one_doc => {
    let doc = _.clone(one_doc);
    doc['_key'] = `view_${count}_${opts.count}`;
    doc['animal'] = one_doc;
    doc['name'] = one_doc;
    cview.insert(doc);
    count += 1;
  });
  print(`${opts.count} - ${count}.`);
}
print(`DONE! ${options.count}`);
