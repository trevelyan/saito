var fs = require('fs'), path = require('path');

supportedFileRegex = /\.(js|coffee)$/

module.exports = exports = function walk(dir, regExcludes, cb) {

  var results = [];

  fs.readdir(dir, function (err, list) {
    if (err) return cb(err);

    var pending = list.length;
    if (!pending) return cb(null, results);

    list.forEach(function (file) {
      file = path.join(dir, file);

      var included = isIncluded(file, regExcludes);
      // Add if not in regExcludes
      if(included) {
        // Check if its a folder
        fs.stat(file, function (err, stat) {
          if (err) return cb(err);
          if (stat && stat.isDirectory()) {
            // If it is, walk again
            walk(file, regExcludes, function (err, res) {
              if (err) return cb(err);

              results = results.concat(res);
              if (!--pending) { cb(null, results); }

            });
          } else {
            if (supportedFileRegex.test(path.basename(file))) results.push(file)
            if (!--pending) { cb(null, results); }
          }
        });
      } else {
        if (!--pending) { cb(null, results); }
      }
    });
  });
};


function isIncluded (file, regExcludes) {
  return !((regExcludes.length > 0) && matchingRegexs(file, regExcludes));
}


function matchingRegexs(file, regexs) {
  var i = 0, len = regexs.length;
  for (; i < len; i++) {
    if (regexs[i].test(file)) {
      return true
    }
  }
  return false;
}
