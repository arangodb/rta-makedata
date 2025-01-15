/* global print, fs, db, internal, arango, assertTrue */

// inspired by shell-foxx-api-spec.js

const utils = require('@arangodb/foxx/manager-utils');
const download = internal.download;
const path = require('path');

function loadFoxxIntoZip (path) {
  let zip = utils.zipDirectory(path);
  let content = fs.readFileSync(zip);
  fs.remove(zip);
  return {
    type: 'inlinezip',
    buffer: content
  };
}

function installFoxx (database, mountpoint, which, mode, options) {
  print(`${Date()} 070: Installing Foxx  to ${mountpoint}`);
  let headers = {};
  let content;
  if (which.type === 'js') {
    headers['content-type'] = 'application/javascript';
    content = which.buffer;
  } else if (which.type === 'dir') {
    headers['content-type'] = 'application/zip';
    var utils = require('@arangodb/foxx/manager-utils');
    let zip = utils.zipDirectory(which.buffer);
    content = fs.readFileSync(zip);
    fs.remove(zip);
  } else if (which.type === 'inlinezip') {
    content = which.buffer;
    headers['content-type'] = 'application/zip';
  } else if (which.type === 'url') {
    content = { source: which };
  } else if (which.type === 'file') {
    content = fs.readFileSync(which.buffer);
  }
  let devmode = '';
  if (typeof which.devmode === "boolean") {
    devmode = `&development=${which.devmode}`;
  }
  let crudResp;
  if (mode === "upgrade") {
    crudResp = arango.PATCH(`/_db/${database}/_api/foxx/service?mount=${mountpoint}${devmode}`, content, headers);
  } else if (mode === "replace") {
    crudResp = arango.PUT(`/_db/${database}/_api/foxx/service?mount=${mountpoint}${devmode}`, content, headers);
  } else {
    try {
      let reply = download(arango.getEndpoint().replace(/^tcp:/, 'http:').replace(/^ssl:/, 'https:') +
                           `/_db/${database}/_api/foxx?mount=${mountpoint}${devmode}`,
                           content,
                           {
                             method: 'POST',
                             headers: headers,
                             timeout: 300,
                             username: 'root',
                             password: options.passvoid
                           });
      assertEqual(reply.code, 201, "Reply was: " + JSON.stringify(reply));
      crudResp = JSON.parse(reply.body);
    } catch (ex) {
      print(`${Date()} 070: installing foxx service threw an exception: ${ex}`);
      throw ex;
    }
  }
  assertTrue(crudResp.hasOwnProperty('manifest'), "Manifest broken: " + JSON.stringify(crudResp));
  return crudResp;
}

function deleteFoxx (database, mountpoint) {
  const deleteResp = arango.DELETE(`/_db/${database}/_api/foxx/service?force=true&mount=${mountpoint}`);
  assertTrue(deleteResp.hasOwnProperty('code'), "reply without code: " + JSON.stringify(deleteResp));
  assertEqual(deleteResp.code, 204, "Reply was: " + JSON.stringify(deleteResp));
  assertFalse(deleteResp.error, "Reply was: " + JSON.stringify(deleteResp));
}

const itzpapalotlPath = path.resolve(internal.pathForTesting('common'), 'test-data', 'apps', 'itzpapalotl');
const itzpapalotlZip = loadFoxxIntoZip(itzpapalotlPath);

const minimalWorkingServicePath = path.resolve(internal.pathForTesting('common'), 'test-data', 'apps', 'crud');
const minimalWorkingZip = loadFoxxIntoZip(minimalWorkingServicePath);
const minimalWorkingZipDev = {
  buffer: minimalWorkingZip.buffer,
  devmode: true,
  type: minimalWorkingZip.type
};
const minimalWorkingZipPath = utils.zipDirectory(minimalWorkingServicePath);

const serviceServicePath = path.resolve(internal.pathForTesting('common'), 'test-data', 'apps', 'service-service', 'index.js');
const crudTestServiceSource = {
  type: 'js',
  buffer: fs.readFileSync(serviceServicePath)
};

(function () {
  let aardvarkRoute = '/_db/_system/_admin/aardvark/index.html';
  let shouldValidateFoxx;
  const onlyJson = {
    'accept': 'application/json',
    'accept-content-type': 'application/json'
  };
  let testFoxxRoutingReady = function() {
    for (let i = 0; i < 200; i++) {
      try {
        let reply = arango.GET_RAW('/this_route_is_not_here', onlyJson);
        if (reply.code === 404) {
          print(`${Date()} 070: selfHeal was already executed - Foxx is ready!`);
          return 0;
        }
        print(`${Date()} 070: Not yet ready, retrying: ${JSON.stringify(reply.parsedBody)}`);
      } catch (e) {
        print(`${Date()} 070: Caught - need to retry. ${JSON.stringify(e)}`);
      }
      internal.sleep(3);
    }
    throw new Error("070: foxx routing not ready on time!");
  };
  let testFoxxReady = function(route) {
    for (let i = 0; i < 200; i++) {
      try {
        let reply = arango.GET_RAW(route, onlyJson);
        if (reply.code === 200) {
          print(`${Date()} 070: ${route} OK`);
          return 0;
        }
        let msg = JSON.stringify(reply);
        if (reply.hasOwnProperty('parsedBody')) {
          msg = " '" + reply.parsedBody.errorNum + "' - " + reply.parsedBody.errorMessage;
        }
        print(`${Date()} 070: ${route} Not yet ready, retrying: ${msg}`);
      } catch (e) {
        print(`${Date()} 070: ${route}Caught - need to retry. ${JSON.stringify(e)}`);
      }
      internal.sleep(3);
    }
    throw new Error("070: foxx route '" + route + "' not ready on time!");
  };    
  return {
    isSupported: function (version, oldVersion, options, enterprise, cluster) {
      return options.testFoxx;
    },
    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      // All items created must contain dbCount
      testFoxxRoutingReady();
      testFoxxReady(aardvarkRoute);
      print(`${Date()} 070: making per database data ${database}`);
      print(`${Date()} 070: installing Itzpapalotl`);
      // installFoxx('/itz', itzpapalotlZip, "install", options);

      installFoxx(database, `/itz_${dbCount}`, itzpapalotlZip, "install", options);

      print(`${Date()} 070: installing crud`);
      installFoxx(database, `/crud_${dbCount}`, minimalWorkingZip, "install", options);
      return 0;
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      print(`${Date()} 070: checking data ${dbCount} `);
      let reply;
      testFoxxRoutingReady();
      [
        aardvarkRoute,
        `/_db/${database}/itz_${dbCount}/index`,
        `/_db/${database}/crud_${dbCount}/xxx`
      ].forEach(route => testFoxxReady(route));

      print(`${Date()} 070: Foxx: Itzpapalotl getting the root of the gods`);
      reply = arango.GET_RAW(`/_db/${database}/itz_${dbCount}`);
      assertEqual(reply.code, "307", JSON.stringify(reply));

      print(`${Date()} 070: Foxx: Itzpapalotl getting index html with list of gods`);
      reply = arango.GET_RAW(`/_db/${database}/itz_${dbCount}/index`);
      assertEqual(reply.code, "200", JSON.stringify(reply));

      print(`${Date()} 070: Foxx: Itzpapalotl summoning Chalchihuitlicue`);
      reply = arango.GET_RAW(`/_db/${database}/itz_${dbCount}/Chalchihuitlicue/summon`, onlyJson);
      assertEqual(reply.code, "200", JSON.stringify(reply));
      let parsedBody = JSON.parse(reply.body);
      assertEqual(parsedBody.name, "Chalchihuitlicue");
      assertTrue(parsedBody.summoned);

      print(`${Date()} 070: Foxx: crud testing get xxx`);
      reply = arango.GET_RAW(`/_db/${database}/crud_${dbCount}/xxx`, onlyJson);
      assertEqual(reply.code, "200", JSON.stringify(reply));
      parsedBody = JSON.parse(reply.body);
      assertEqual(parsedBody, []);

      print(`${Date()} 070: Foxx: crud testing POST xxx`);

      reply = arango.POST_RAW(`/_db/${database}/crud_${dbCount}/xxx`, {_key: "test"});
      if (options.readOnly) {
        assertEqual(reply.code, "400", JSON.stringify(reply));
      } else {
        assertEqual(reply.code, "201", JSON.stringify(reply));
      }

      print(`${Date()} 070: Foxx: crud testing get xxx`);
      reply = arango.GET_RAW(`/_db/${database}/crud_${dbCount}/xxx`, onlyJson);
      assertEqual(reply.code, "200");
      parsedBody = JSON.parse(reply.body);
      if (options.readOnly) {
        assertEqual(parsedBody, [], JSON.stringify(reply));
      } else {
        assertEqual(parsedBody.length, 1, JSON.stringify(reply));
      }

      print(`${Date()} 070: Foxx: crud testing delete document`);
      reply = arango.DELETE_RAW(`/_db/${database}/crud_${dbCount}/xxx/test`);
      if (options.readOnly) {
        assertEqual(reply.code, "400", JSON.stringify(reply));
      } else {
        assertEqual(reply.code, "204", JSON.stringify(reply));
      }
      return 0;
    },
    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      // All items created must contain dbCount
      print(`${Date()} 070: deleting foxx ${dbCount}`);
      print(`${Date()} 070: uninstalling Itzpapalotl`);
      deleteFoxx(database, `/itz_${dbCount}`);

      print(`${Date()} 070: uninstalling crud`);
      deleteFoxx(database, `/crud_${dbCount}`);
      return 0;
    },
  };
}());
