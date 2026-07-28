/* global print, fs, db, internal, arango, assertTrue */
/* global loadFoxxIntoZip, installFoxx, deleteFoxx, itzpapalotlZip, itzpapalotlPath, minimalWorkingServicePath, minimalWorkingZip, assertEqual, semver */

(function () {
  let extendedNames = ["ᇤ፼ᢟ⚥㑸ন", "に楽しい新習慣", "うっとりとろける", "זַרקוֹר", "ስፖትላይት", "بقعة ضوء", "ուշադրության կենտրոնում", "🌸🌲🌵 🍃💔"];
  let aardvarkRoute = '/_db/_system/_admin/aardvark/index.html';
  let shouldValidateFoxx;
  const onlyJson = {
    'accept': 'application/json',
    'accept-content-type': 'application/json'
  };
  return {
    isSupported: function (currentVersion, oldVersion, options, enterprise, cluster) {
      let currentVersionSemver = semver.parse(semver.coerce(currentVersion));
      let oldVersionSemver = semver.parse(semver.coerce(oldVersion));
      return options.testFoxx && semver.gte(currentVersionSemver, "3.11.0") && semver.gte(oldVersionSemver, "3.11.0");
    },
    makeDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      database = `${extendedNames[0]}FoxxTest${extendedNames[3]}_${dbCount}`;
      print(`${Date()} 071: creating ${database}`);
      db._useDatabase('_system');
      db._createDatabase(database);
      db._useDatabase(database);
      
      // All items created must contain dbCount
      testFoxxRoutingReady();
      testFoxxReady(aardvarkRoute);
      print(`${Date()} 071: making per database data ${dbCount}`);
      print(`${Date()} 071: installing Itzpapalotl`);
      // installFoxx('071', '/itz', itzpapalotlZip, "install", options);
      const itzpapalotlZip = loadFoxxIntoZip(itzpapalotlPath);

      installFoxx('071', database, `/itz_${dbCount}`, itzpapalotlZip, "install", options);

      print(`${Date()} 071: installing crud`);
      const minimalWorkingZip = loadFoxxIntoZip(minimalWorkingServicePath);
      const minimalWorkingZipDev = {
        buffer: minimalWorkingZip.buffer,
        devmode: true,
        type: minimalWorkingZip.type
      };
      installFoxx('071', database, `/crud_${dbCount}`, minimalWorkingZip, "install", options);
      db._useDatabase('_system');
      return 0;
    },
    checkDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      database = `${extendedNames[0]}FoxxTest${extendedNames[3]}_${dbCount}`;
      print(`${Date()} 071: checking foxx ${database}`);
      let reply;

      [
        aardvarkRoute,
        `/_db/${database}/itz_${dbCount}/index`,
        `/_db/${database}/crud_${dbCount}/xxx`
      ].forEach(route => testFoxxReady(route));

      print(`${Date()} 071: Foxx: Itzpapalotl getting the root of the gods`);
      reply = arango.GET_RAW(`/_db/${database}/itz_${dbCount}`);
      assertEqual(reply.code, "307", JSON.stringify(reply));

      print(`${Date()} 071: Foxx: Itzpapalotl getting index html with list of gods`);
      reply = arango.GET_RAW(`/_db/${database}/itz_${dbCount}/index`);
      assertEqual(reply.code, "200", JSON.stringify(reply));

      print(`${Date()} 071: Foxx: Itzpapalotl summoning Chalchihuitlicue`);
      reply = arango.GET_RAW(`/_db/${database}/itz_${dbCount}/Chalchihuitlicue/summon`, onlyJson);
      assertEqual(reply.code, "200", JSON.stringify(reply));
      let parsedBody = JSON.parse(reply.body);
      assertEqual(parsedBody.name, "Chalchihuitlicue");
      assertTrue(parsedBody.summoned);

      print(`${Date()} 071: Foxx: crud testing get xxx`);
      reply = arango.GET_RAW(`/_db/${database}/crud_${dbCount}/xxx`, onlyJson);
      assertEqual(reply.code, "200", JSON.stringify(reply));
      parsedBody = JSON.parse(reply.body);
      assertEqual(parsedBody, [], JSON.stringify(reply));

      print(`${Date()} 071: Foxx: crud testing POST xxx`);

      reply = arango.POST_RAW(`/_db/${database}/crud_${dbCount}/xxx`, {_key: "test"});
      if (readOnly) {
        assertEqual(reply.code, "400", JSON.stringify(reply));
      } else {
        assertEqual(reply.code, "201", JSON.stringify(reply));
      }

      print(`${Date()} 071: Foxx: crud testing get xxx`);
      reply = arango.GET_RAW(`/_db/${database}/crud_${dbCount}/xxx`, onlyJson);
      assertEqual(reply.code, "200", JSON.stringify(reply));
      parsedBody = JSON.parse(reply.body);
      if (readOnly) {
        assertEqual(parsedBody, []);
      } else {
        assertEqual(parsedBody.length, 1);
      }

      print(`${Date()} 071: Foxx: crud testing delete document`);
      reply = arango.DELETE_RAW(`/_db/${database}/crud_${dbCount}/xxx/` + 'test');
      if (readOnly) {
        assertEqual(reply.code, "400", JSON.stringify(reply));
      } else {
        assertEqual(reply.code, "204", JSON.stringify(reply));
      }
      return 0;
    },
    waitDataDB: function (options, isCluster, isEnterprise, database, dbCount, readOnly) {
      database = `${extendedNames[0]}FoxxTest${extendedNames[3]}_${dbCount}`;
      testFoxxRoutingReady();
      [
        aardvarkRoute,
        `/_db/${database}/itz_${dbCount}/index`,
        `/_db/${database}/crud_${dbCount}/xxx`
      ].forEach(route => testFoxxReady(route, '071'));
    },
    clearDataDB: function (options, isCluster, isEnterprise, database, dbCount) {
      print(`${Date()} 071: clearing foxx services ${dbCount}`);
      // All items created must contain dbCount
      database = `${extendedNames[0]}FoxxTest${extendedNames[3]}_${dbCount}`;
      print(`${Date()} 071: deleting foxx ${dbCount}${database}`);
      db._useDatabase(database);
      print(`${Date()} 071: uninstalling Itzpapalotl`);
      deleteFoxx(database, `/itz_${dbCount}`);

      print(`${Date()} 071: uninstalling crud`);
      deleteFoxx(database, `/crud_${dbCount}`);
      db._useDatabase('_system');
      db._dropDatabase(database);
      return 0;
    },
  };
}());
