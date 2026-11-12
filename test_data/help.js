/* global print */
//
// --help for makedata.js / checkdata.js / cleardata.js / waitdata.js
// Must not touch the server, so the entry scripts invoke it before their first request.
// The text is taken from the calling script itself so it can't get out of sync:
//  - its leading comment block: usage text, plus one "`--name [default] description"
//    line per option (indented lines continue the previous option's description)
//  - every key of its `optionsDefaults` object together with the default value
// Each option is printed once, with its default and its description merged.
'use strict';
const fs = require('fs');

function wantsHelp(argv) {
  return argv.indexOf('--help') >= 0 || argv.indexOf('-h') >= 0;
}

// split the leading comment block into usage text and option descriptions
function parseHeader(lines) {
  let usage = [];
  let descriptions = new Map();
  let lastOption = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('//')) {
      if (usage.length > 0 || descriptions.size > 0 || !line.startsWith('/*')) {
        break;
      }
      continue;
    }
    const text = line.replace(/^\/\/ ?/, '');
    const m = /^`?--([A-Za-z0-9_]+)(?:\s+(?:\[[^\]]*\]|true|false)(?=\s|$))?\s*(.*)$/.exec(text);
    if (m !== null) {
      lastOption = m[1];
      const known = descriptions.get(lastOption);
      descriptions.set(lastOption, known ? `${known}; ${m[2]}` : m[2]);
    } else if (lastOption !== null && /^\s{2,}\S/.test(text)) {
      descriptions.set(lastOption, `${descriptions.get(lastOption)} ${text.trim()}`);
    } else {
      lastOption = null;
      usage.push(text);
    }
  }
  return {usage, descriptions};
}

function parseDefaults(lines) {
  let defaults = [];
  const start = lines.findIndex(line => /^const optionsDefaults = \{/.test(line));
  if (start >= 0) {
    for (let i = start + 1; i < lines.length && !/^\};/.test(lines[i]); i++) {
      const m = /^\s*([A-Za-z0-9_]+)\s*:\s*(.*?),?\s*$/.exec(lines[i]);
      if (m !== null) {
        let value = m[2];
        if (value === 'dbVersion') {
          value = '<server version>';
        } else if (value === 'undefined') {
          value = '-';
        }
        defaults.push({name: m[1], value});
      }
    }
  }
  return defaults;
}

function printHelpAndExit(scriptPath) {
  const lines = fs.read(scriptPath).split('\n');
  const {usage, descriptions} = parseHeader(lines);
  const defaults = parseDefaults(lines);

  while (usage.length > 0 && usage[usage.length - 1].trim() === '') {
    usage.pop();
  }
  print(usage.join('\n'));

  const printOption = (name, value, description) => {
    print(`  --${name.padEnd(32)} ${value.padEnd(18)} ${description}`.trimEnd());
  };
  print('\nOptions (pass as --name value):');
  printOption('<name>', 'default', 'description');
  defaults.forEach(({name, value}) => {
    printOption(name, value, descriptions.get(name) || '');
    descriptions.delete(name);
  });
  // documented, but without an entry in optionsDefaults
  descriptions.forEach((description, name) => {
    printOption(name, '-', description);
  });
  printOption('help', '-', 'print this help and exit');
  process.exit(0);
}

exports.wantsHelp = wantsHelp;
exports.printHelpAndExit = printHelpAndExit;
