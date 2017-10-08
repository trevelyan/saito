var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');


//////////////////
// CONSTRUCTOR  //
//////////////////
function Subscribe(app) {

  if (!(this instanceof Subscribe)) { return new Subscribe(app); }

  Subscribe.super_.call(this);

  this.app             = app;

  this.name            = "Subscribe";
  this.browser_active  = 0;
  this.handlesEmail    = 1;

  this.host            = "localhost"; // hardcoded
  this.port            = "12100";     // hardcoded
  this.publickey       = "";          // hardcoded

  return this;

}
module.exports = Subscribe;
util.inherits(Subscribe, ModTemplate);


////////////////
// Initialize //
////////////////
Subscribe.prototype.initialize = function initialize() {
  this.publickey = this.app.wallet.returnPublicKey();
}


////////////////////
// Install Module //
////////////////////
Subscribe.prototype.installModule = function installModule() {

  if (this.app.BROWSER == 1) { return; }

  sql = "\
        CREATE TABLE IF NOT EXISTS mod_subscriptions (\
                id INTEGER, \
                publickey TEXT, \
                tx TEXT, \
                payment_received INTEGER, \
                tokens_issued INTEGER, \
                unixtime INTEGER, \
                PRIMARY KEY(id ASC) \
        )";
  this.app.storage.execDatabase(sql, {}, function() {});

}








////////////////////////
// Display Email Form //
////////////////////////
Subscribe.prototype.displayEmailForm = function displayEmailForm(app) {

  element_to_edit = $('#module_editable_space');
  element_to_edit_html = ' \
<div style="font-size:1.4em;padding:40px;"> \
Purchase Saito Tokens: \
<p></p> \
To purchase Saito tokens, please visit our <a href="/subscribe">token purchase page</a>. \
</div> \
<style> \
';
  element_to_edit.html(element_to_edit_html);

}









/////////////////////////
// Handle Web Requests //
/////////////////////////
Subscribe.prototype.webServer = function webServer(app, expressapp) {

  expressapp.get('/subscribe/', function (req, res) {
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  expressapp.get('/subscribe/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });

}










