#!/usr/bin/env node

/**
 * Module dependencies.
 */

var path = require('path'),
  util = require('util'),
  program = require('commander'),
  mv = require('../index.js');


function regexList(val) {
  var list = val.split(','), i = 0, len = list.length;
  var ret = [];
  for (; i<len; i++) {
    ret.push(new RegExp(list[i], "g"));
  }
  return ret;
}

program
  .version('0.0.1')
  // Not implemented yet
  .option('-g, --git', 'Rename in git')
  .option('-e, --excludes <items>', 'List of regex for dir/files to excludes', regexList)
  .parse(process.argv);

if (process.argv.length < 4) {
  console.log(program.help());
}

var source = process.argv[2],
  dest = process.argv[3];

var currentDir = process.cwd(),
  originalPath = path.join(currentDir, source),
  destAbsPath = path.join(currentDir, dest);


mv(currentDir, originalPath, destAbsPath, program, function(err) {
  if (err) {
    console.error(util.inspect(err, {depth: 10}));
    process.exit(1);
  }

  process.exit();
})
