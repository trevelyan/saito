var path = require('path'),
  fs = require('fs'),
  exec = require('child_process').exec,
  async = require('async'),
  ProgressBar = require('progress'),
  walk = require('./lib/walk');

var defaultRegExcludes = [/^\.+.*/, /node_modules/];

var bar = null;

module.exports = exports = function(currentDir, originalFilePath, newFilePath, options, cb) {
  validatePaths(originalFilePath, newFilePath, function(err) {
    if (err) return cb(err);

    fs.stat(originalFilePath, function (err, stat) {
      if (err) return cb(err);

      if (stat.isDirectory()) {
        mvDir(currentDir, originalFilePath, newFilePath, options, cb)
      } else {
        mvFile(currentDir, originalFilePath, newFilePath, options, cb)
      }
    });
  })
};

function mvFile(currentDir, originalFilePath, newFilePath, options, cb) {
  steps = [function(cb) {
    rename(originalFilePath, newFilePath, options.git, cb)
  }];
  bar = new ProgressBar(':bar', {total: files.length});
  excludes = getExcludes(options);
  steps.push(function(cb) {updateReferencesInMovedFile(originalFilePath, newFilePath, null, cb)});
  steps.push(function(cb) {updateReferencesToMovedFile(currentDir, originalFilePath, newFilePath, excludes, cb)});

  async.series(steps, cb);
}

function getExcludes(options) {
  var excludes = defaultRegExcludes, steps = [];
  if (options.excludes) {
    excludes = excludes.concat(options.excludes);
  }
  return excludes;
}

function validatePaths(originalFilePath, newFilePath, cb) {
  async.series({
    srcExists: function(cb) {fs.exists(originalFilePath, function(exists) {cb(null, exists)})},
    destExists: function(cb) {fs.exists(newFilePath, function(exists) {cb(null, exists)})}
  }, function(err, result) {
    var srcExists = result.srcExists,
      destExists = result.destExists;

    if (!srcExists) return cb(new Error(originalFilePath + ' does not exist!'));
    if (destExists) return cb(new Error(newFilePath + ' is already exist!'));
    return cb(null, true);
  });
}

function mvDir(currentDir, originalDirPath, newDirPath, options, cb) {
  originalDirPath = originalDirPath.replace(/\/$/, '');
  if (newDirPath[newDirPath.length - 1] === '/') {
    newDirPath = newDirPath + path.basename(originalDirPath)
  }

  validatePaths(originalDirPath, newDirPath, function(err) {
    if (err) return cb(err);

    walk(originalDirPath, [], function(err, files) {
      if (err) return cb(err);

      bar = new ProgressBar('  processing [:bar] :percent :etas', {total: files.length});

      rename(originalDirPath, newDirPath, options.git, function(err) {
        if (err) return cb(err);

        async.eachSeries(files, function(file, cb) {
          bar.tick();
          var newFilePath = file.replace(originalDirPath, newDirPath);

          steps = [];
          steps.push(function(cb) {
            var excludeRequires = '^' + originalDirPath;
            updateReferencesInMovedFile(file, newFilePath, new RegExp(excludeRequires), cb)
          });
          searchExcludes = getExcludes(options);
          steps.push(function(cb) {
            updateReferencesToMovedFile(currentDir, file, newFilePath, searchExcludes, cb)
          });

          async.parallel(steps, cb);

        }, cb)
      })
    })
  });
}

function rename(originalPath, newPath, supportGit, cb) {
  if (supportGit) {
    exec('git mv ' + originalPath + ' ' + newPath, function(err, stdout, stderr) {
      if (err) return cb(err);
      if (stderr) return cb(stderr);
      cb();
    })
  } else {
    fs.rename(originalPath, newPath, cb);
  }
}

function updateReferencesInMovedFile(originalFilePath, newFilePath, excludes, cb) {
  fs.readFile(newFilePath, 'utf8', function(err, data) {
    if (err) return cb(err);

    var requires = getRequires(data);

    if (requires) {
      requires.forEach(function(oldRequire) {
        var newRequire = generateNewRequire(oldRequire, originalFilePath, newFilePath, excludes);
        if (newRequire)
          data = data.replace(oldRequire, newRequire);
      })
    }
    fs.writeFile(newFilePath, data, {encoding: 'utf8'}, cb);
  });
}

function getRequires(fileData) {
  var re = /require(\(|\s)('|")(\.\S+)('|")(\))?/g;
  return fileData.match(re);
}

function generateNewRequire(oldRequire, originalFilePath, newFilePath, excludes) {
  var re = /require(\(|\s)('|")(\.\S+)('|")(\))?/,
    groups = re.exec(oldRequire),
    oldPath = groups[3],
    oldAsbPath = path.join(path.dirname(originalFilePath), oldPath);
    if (excludes && excludes.test(oldAsbPath)) return null;
    newRelativePath = path.relative(path.dirname(newFilePath), oldAsbPath);

  if (newRelativePath.indexOf('.') != 0 ) {
    newRelativePath = './' + newRelativePath;
  }

  return oldRequire.replace(re, 'require$1$2' + newRelativePath + '$4$5');
}

function updateReferencesToMovedFile(currentDir, originalFilePath, newFilePath, regExcludes, cb) {
  walk(currentDir, regExcludes, function(err, files) {
    if (err) return cb(err);

    function updateReferenceForFile(file, cb) {
      var oldRelativePath = path.relative(path.dirname(file), originalFilePath).replace(/\.(js|coffee)$/, ''),
        newRelativePath = path.relative(path.dirname(file), newFilePath).replace(/\.(js|coffee)$/, '');
      if (oldRelativePath.indexOf(".") != 0 ) {
        oldRelativePath = './' + oldRelativePath;
      }
      if (newRelativePath.indexOf(".") != 0 ) {
        newRelativePath = './' + newRelativePath;
      }

      var regex = exports.generateRequireRegex(oldRelativePath);
      fs.readFile(file, 'utf8', function(err, data) {
        if (err) return cb(err);
        if (data.indexOf(regex)) {
          var result = data.replace(regex, 'require$1$2' + newRelativePath + '$4$5');
          return fs.writeFile(file, result, {encoding: 'utf8'}, cb);
        } else {
          return cb()
        }
      })
    }
    async.eachSeries(files, updateReferenceForFile, cb);
  })
}

exports.generateRequireRegex = function(filePath) {
  return new RegExp("require(\\(|\\s)('|\")(" + filePath + ")('|\")(\\))?", "g");
}
