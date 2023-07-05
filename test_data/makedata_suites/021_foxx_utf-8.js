/* global print, fs, db, internal, arango, assertTrue */
/* global loadFoxxIntoZip, installFoxx, deleteFoxx, itzpapalotlZip, minimalWorkingZip, assertEqual */


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
          print("021: selfHeal was already executed - Foxx is ready!");
          return 0;
        }
        print("021: Not yet ready, retrying: " + reply.parsedBody);
      } catch (e) {
        print("021: Caught - need to retry. " + JSON.stringify(e));
      }
      internal.sleep(3);
    }
    throw new Error("foxx routeing not ready on time!");
  };
  let testFoxxReady = function(route) {
    for (let i = 0; i < 200; i++) {
      try {
        let reply = arango.GET_RAW(route, onlyJson);
        if (reply.code === 200) {
          print(route + " OK");
          return 0;
        }
        let msg = JSON.stringify(reply);
        if (reply.hasOwnProperty('parsedBody')) {
          msg = " '" + reply.parsedBody.errorNum + "' - " + reply.parsedBody.errorMessage;
        }
        print(route + " Not yet ready, retrying: " + msg);
      } catch (e) {
        print(route + " Caught - need to retry. " + JSON.stringify(e));
      }
      internal.sleep(3);
    }
    throw new Error("foxx route '" + route + "' not ready on time!");
  };    
  return {
    isSupported: function (version, oldVersion, options, enterprise, cluster) {
      return options.testFoxx;
    },
    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      let dbName = `${extendedNames[0]}FoxxTest${extendedNames[3]}_${dbCount}`;
      db._useDatabase('_system');
      db._createDatabase(dbName);
      db._useDatabase(dbName);
      
      // All items created must contain dbCount
      testFoxxRoutingReady();
      testFoxxReady(aardvarkRoute);
      print(`021: making per database data ${dbCount}`);
      print("021: installing Itzpapalotl");
      // installFoxx('/itz', itzpapalotlZip, "install", options);

      installFoxx(`/itz_${dbCount}`, itzpapalotlZip, "install", options);

      print("021: installing crud");
      installFoxx(`/crud_${dbCount}`, minimalWorkingZip, "install", options);
      db._useDatabase('_system');
      return 0;
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      let dbName = `${extendedNames[0]}FoxxTest${extendedNames[3]}_${dbCount}`;
      db._useDatabase(dbName);
      print(`021: checking data ${dbCount} ${dbName}`);
      let reply;

      [
        aardvarkRoute,
        `/_db/_system/itz_${dbCount}/index`,
        `/_db/_system/crud_${dbCount}/xxx`
      ].forEach(route => testFoxxReady(route));

      print("021: Foxx: Itzpapalotl getting the root of the gods");
      reply = arango.GET_RAW(`/_db/_system/itz_${dbCount}`);
      assertEqual(reply.code, "307", JSON.stringify(reply));

      print('021: Foxx: Itzpapalotl getting index html with list of gods');
      reply = arango.GET_RAW(`/_db/_system/itz_${dbCount}/index`);
      assertEqual(reply.code, "200", JSON.stringify(reply));

      print("021: Foxx: Itzpapalotl summoning Chalchihuitlicue");
      reply = arango.GET_RAW(`/_db/_system/itz_${dbCount}/Chalchihuitlicue/summon`, onlyJson);
      assertEqual(reply.code, "200", JSON.stringify(reply));
      let parsedBody = JSON.parse(reply.body);
      assertEqual(parsedBody.name, "Chalchihuitlicue");
      assertTrue(parsedBody.summoned);

      print("021: Foxx: crud testing get xxx");
      reply = arango.GET_RAW(`/_db/_system/crud_${dbCount}/xxx`, onlyJson);
      assertEqual(reply.code, "200");
      parsedBody = JSON.parse(reply.body);
      assertEqual(parsedBody, []);

      print("021: Foxx: crud testing POST xxx");

      reply = arango.POST_RAW(`/_db/_system/crud_${dbCount}/xxx`, {_key: "test"});
      if (options.readOnly) {
        assertEqual(reply.code, "400");
      } else {
        assertEqual(reply.code, "201");
      }

      print("021: Foxx: crud testing get xxx");
      reply = arango.GET_RAW(`/_db/_system/crud_${dbCount}/xxx`, onlyJson);
      assertEqual(reply.code, "200");
      parsedBody = JSON.parse(reply.body);
      if (options.readOnly) {
        assertEqual(parsedBody, []);
      } else {
        assertEqual(parsedBody.length, 1);
      }

      print('021: Foxx: crud testing delete document');
      reply = arango.DELETE_RAW(`/_db/_system/crud_${dbCount}/xxx/` + 'test');
      if (options.readOnly) {
        assertEqual(reply.code, "400");
      } else {
        assertEqual(reply.code, "204");
      }
      db._useDatabase('_system');
      return 0;
    },
    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      // All items created must contain dbCount
      let dbName = `${extendedNames[0]}FoxxTest${extendedNames[3]}_${dbCount}`;
      db._useDatabase(dbName);
      print(`deleting foxx ${dbCount}${dbName}`);
      print("uninstalling Itzpapalotl");
      deleteFoxx(`/itz_${dbCount}`);

      print("uninstalling crud");
      deleteFoxx(`/crud_${dbCount}`);
      db._useDatabase('_system');
      db._dropDatabase(dbName);
      return 0;
    },
  };
}());
