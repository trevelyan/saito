var saito  = require('./saito');
var prompt = require('sync-prompt').prompt;
var fs     = require('fs');


var app            = {};
    app.BROWSER    = 0;
    app.SPVMODE    = 0;

////////////////////
// Load Variables //
////////////////////
app.crypt      = new saito.crypt();
app.storage    = new saito.storage(app);
app.wallet     = new saito.wallet(app);
app.browser    = new saito.browser(app);
app.archives   = new saito.archives(app);
//app.aes        = new saito.aes(app);
app.dns        = new saito.dns(app);
app.keys       = new saito.keys(app);
app.network    = new saito.network(app);
app.blockchain = new saito.blockchain(app);
app.server     = new saito.server(app);
app.modules    = require('./modules/mods')(app);




/////////////////////////
// Installation Script //
/////////////////////////
console.log(' \n\n\
Welcome to Saito. \n\
\n\
This installation script will automate the creation of the options file\n\
you will need to run a node on the network. Once you have created this \n\
file you can start the application. \n\
\n\
');


var keyexists = prompt("Do you already have a public/private keypair? ");

console.log("DONE: "+keyexists);

/*************
////////////////
// Initialize //
////////////////
app.storage.initialize();
app.wallet.initialize();
app.blockchain.initialize();
//app.aes.initialize();
app.keys.initialize();
app.network.initialize();
// archives before modules
app.archives.initialize();
app.modules.pre_initialize();
app.modules.initialize();
// dns before browser so modules can 
// initialize with dns support
app.dns.initialize();
app.browser.initialize();
// server initialized after modules
// so that the modules can use the
// server to feed their own subpages
// as necessary
app.server.initialize();
**************/




/////////////////////
// Cntl-C to Close //
/////////////////////
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



