var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');


//////////////////
// CONSTRUCTOR  //
//////////////////
function Secret(app) {

  if (!(this instanceof Secret)) { return new Secret(app); }

  Secret.super_.call(this);

  this.app             = app;

  this.name            = "Secret";
  this.browser_active  = 0;

  return this;

}
module.exports = Secret;
util.inherits(Secret, ModTemplate);


////////////////
// Initialize //
////////////////
Secret.prototype.initialize = function initialize() {
}


////////////////////
// Install Module //
////////////////////
Secret.prototype.installModule = function installModule() {

  sql = "\
        CREATE TABLE IF NOT EXISTS mod_registry_addresses (\
                id INTEGER, \
                identifier TEXT, \
                publickey TEXT, \
                unixtime INTEGER, \
                PRIMARY KEY(id ASC) \
        )";
  this.app.storage.execDatabase(sql, {}, function() {});

}




