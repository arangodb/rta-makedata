/* global print, fs, db, internal, arango, assertTrue */
/* global loadFoxxIntoZip, installFoxx, deleteFoxx, itzpapalotlZip, minimalWorkingZip, assertEqual, semver */

(function () {
  let extendedNames = ["ᇤ፼ᢟ⚥㑸ন", "に楽しい新習慣", "うっとりとろける", "זַרקוֹר", "ስፖትላይት", "بقعة ضوء", "ուշադրության կենտրոնում", "🌸🌲🌵 🍃💔"];
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
          progress("071: selfHeal was already executed - Foxx is ready!");
          return 0;
        }
        progress("071: Not yet ready, retrying: " + reply.parsedBody);
      } catch (e) {
        progress("071: Caught - need to retry. " + JSON.stringify(e));
      }
      internal.sleep(3);
    }
    throw new Error("071: foxx routeing not ready on time!");
  };
  let testFoxxReady = function(route) {
    for (let i = 0; i < 200; i++) {
      try {
        let reply = arango.GET_RAW(route, onlyJson);
        if (reply.code === 200) {
          progress(`071: ${route} OK`);
          return 0;
        }
        let msg = JSON.stringify(reply);
        if (reply.hasOwnProperty('parsedBody')) {
          msg = " '" + reply.parsedBody.errorNum + "' - " + reply.parsedBody.errorMessage;
        }
        progress(route + " Not yet ready, retrying: " + msg);
      } catch (e) {
        progress(route + " Caught - need to retry. " + JSON.stringify(e));
      }
      internal.sleep(3);
    }
    throw new Error("foxx route '" + route + "' not ready on time!");
  };    
  return {
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      let currentVersionSemver = semver.parse(semver.coerce(currentVersion));
      let oldVersionSemver = semver.parse(semver.coerce(oldVersion));
      return options.testFoxx && semver.gte(currentVersionSemver, "3.11.0") && semver.gte(oldVersionSemver, "3.11.0");
    },
    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      database = `${extendedNames[0]}FoxxTest${extendedNames[3]}_${dbCount}`;
      progress(`071: creating ${database}`);
      db._useDatabase('_system');
      db._createDatabase(database);
      db._useDatabase(database);
      
      // All items created must contain dbCount
      testFoxxRoutingReady();
      testFoxxReady(aardvarkRoute);
      progress(`071: making per database data ${dbCount}`);
      progress("071: installing Itzpapalotl");
      // installFoxx('/itz', itzpapalotlZip, "install", options);

      installFoxx(database, `/itz_${dbCount}`, itzpapalotlZip, "install", options);

      progress("071: installing crud");
      installFoxx(database, `/crud_${dbCount}`, minimalWorkingZip, "install", options);
      db._useDatabase('_system');
      return 0;
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      database = `${extendedNames[0]}FoxxTest${extendedNames[3]}_${dbCount}`;
      progress(`071: checking foxx ${database}`);
      let reply;

      [
        aardvarkRoute,
        `/_db/${database}/itz_${dbCount}/index`,
        `/_db/${database}/crud_${dbCount}/xxx`
      ].forEach(route => testFoxxReady(route));

      progress("071: Foxx: Itzpapalotl getting the root of the gods");
      reply = arango.GET_RAW(`/_db/${database}/itz_${dbCount}`);
      assertEqual(reply.code, "307", JSON.stringify(reply));

      progress('071: Foxx: Itzpapalotl getting index html with list of gods');
      reply = arango.GET_RAW(`/_db/${database}/itz_${dbCount}/index`);
      assertEqual(reply.code, "200", JSON.stringify(reply));

      progress("071: Foxx: Itzpapalotl summoning Chalchihuitlicue");
      reply = arango.GET_RAW(`/_db/${database}/itz_${dbCount}/Chalchihuitlicue/summon`, onlyJson);
      assertEqual(reply.code, "200", JSON.stringify(reply));
      let parsedBody = JSON.parse(reply.body);
      assertEqual(parsedBody.name, "Chalchihuitlicue");
      assertTrue(parsedBody.summoned);

      progress("071: Foxx: crud testing get xxx");
      reply = arango.GET_RAW(`/_db/${database}/crud_${dbCount}/xxx`, onlyJson);
      assertEqual(reply.code, "200", JSON.stringify(reply));
      parsedBody = JSON.parse(reply.body);
      assertEqual(parsedBody, [], JSON.stringify(reply));

      progress("071: Foxx: crud testing POST xxx");

      reply = arango.POST_RAW(`/_db/${database}/crud_${dbCount}/xxx`, {_key: "test"});
      if (options.readOnly) {
        assertEqual(reply.code, "400", JSON.stringify(reply));
      } else {
        assertEqual(reply.code, "201", JSON.stringify(reply));
      }

      progress("071: Foxx: crud testing get xxx");
      reply = arango.GET_RAW(`/_db/${database}/crud_${dbCount}/xxx`, onlyJson);
      assertEqual(reply.code, "200", JSON.stringify(reply));
      parsedBody = JSON.parse(reply.body);
      if (options.readOnly) {
        assertEqual(parsedBody, []);
      } else {
        assertEqual(parsedBody.length, 1);
      }

      progress('071: Foxx: crud testing delete document');
      reply = arango.DELETE_RAW(`/_db/${database}/crud_${dbCount}/xxx/` + 'test');
      if (options.readOnly) {
        assertEqual(reply.code, "400", JSON.stringify(reply));
      } else {
        assertEqual(reply.code, "204", JSON.stringify(reply));
      }
      return 0;
    },
    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      progress(`071: clearing foxx services ${dbcount}`);
      // All items created must contain dbCount
      database = `${extendedNames[0]}FoxxTest${extendedNames[3]}_${dbCount}`;
      progress(`071: deleting foxx ${dbCount}${database}`);
      db._useDatabase(database);
      progress("071: uninstalling Itzpapalotl");
      deleteFoxx(database, `/itz_${dbCount}`);

      progress("071: uninstalling crud");
      deleteFoxx(database, `/crud_${dbCount}`);
      db._useDatabase('_system');
      db._dropDatabase(database);
      return 0;
    },
  };
}());
