var saito   = require('../saito');
var fs      = require('fs');


function Storage(app) {

  if (!(this instanceof Storage)) {
    return new Storage(app);
  }

  this.app  = app || {};

  return this;

}
module.exports = Storage;







