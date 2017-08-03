//
// clean this up, the reference is 
// from the blockchain class
// 
//
var t       = exports;
    t.utils = require('./saito/utils');
var saito   = require('./saito');





var app            = {};



///////////////////////////////////////////
// are we running in browser / lite-mode //
///////////////////////////////////////////
app.BROWSERIFY = 0;




////////////////////
// Load Variables //
////////////////////
app.crypt      = new saito.crypt();
app.storage    = new saito.storage(app);
app.wallet     = new saito.wallet(app);
app.blockchain = new saito.blockchain(app);
app.network    = new saito.network(app);
app.server     = new saito.server(app);
app.browser    = new saito.browser(app);
app.modules    = require('./modules/mods')(app);




////////////////
// Initialize //
////////////////































/********
app.storage    = new trust.storage(app);
app.storage.loadOptions();
app.storage.writeClientOptionFile();

// if we have a saved key, use it
if (app.options["Wallet"] != null) {
  app.wallet     = new trust.wallet(app, JSON.stringify(app.options["Wallet"]));
} else {
  app.wallet     = new trust.wallet(app);
}
app.blockchain = new trust.blockchain(app);
app.network    = new trust.network(app);



if (app.BROWSERIFY == 0) {

  app.server     = new trust.server(app);
  app.network.connect();

} else {

  // we have fetched the server information and possibly
  // our peer situation if we loaded a local file, so
  // we can connect to the server that fed us the 
  // client.json
  // 
  app.network.connect();

}


app.modules    = require('./modules/mods')(app);
app.browser    = new trust.browser(app);

// total hack
app.browser.app = app;











///////////////////////////
// Start the Application //
///////////////////////////

// this starts the process of producing blocks on 
// a difficulty timer. If we have already initialized
// the network, we will already have a blockchain we
// can build upon.
if (app.BROWSERIFY == 0) {
  app.blockchain.mempool.startBundling();
}
******/












// create hooks for application closure
// these force the application to close
// sensibly and can be triggered by Cntl-C
// but not Cntl-Z

process.on('SIGTERM', function () {
  app.server.close();
  app.network.close();
  console.log("Network Shutdown");
});
process.on('SIGINT', function () {
  app.server.close();
  app.network.close();
  console.log("Network Shutdown");
});




