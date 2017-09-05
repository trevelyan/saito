var saito = require('./saito');
var app            = {};
    app.BROWSER    = 1;
    app.SPVMODE    = 1;


////////////////////
// Load Variables //
////////////////////
app.crypt      = new saito.crypt();
app.browser    = new saito.browser(app);
app.archives   = new saito.archives(app);
app.storage    = new saito.storage(app);
app.aes        = new saito.aes(app);
app.dns        = new saito.dns(app);
app.keys       = new saito.keys(app);
app.wallet     = new saito.wallet(app);
app.network    = new saito.network(app);
app.blockchain = new saito.blockchain(app);
app.server     = new saito.server(app);
app.queue      = new saito.queue(app);
app.modules    = require('./modules/mods')(app);



////////////////
// Initialize //
////////////////
app.storage.initialize();
//
app.wallet.initialize();
app.queue.initialize();
// archives before modules
app.archives.initialize();
app.aes.initialize();
app.keys.initialize();
app.modules.initialize();
// server initialized after modules
// so that the modules can use the
// server to feed their own subpages
// as necessary
app.server.initialize();
// network before classes that manage specialized peers
app.network.initialize();
// dns before browser so modules can initialize with dns requests, after ntwork
app.dns.initialize();
app.blockchain.initialize();
app.browser.initialize();


console.log("\n\nWelcome to Saito\n\n");
console.log(app.wallet.returnPublicKey());
console.log(app.wallet.returnPublicKey());

//app.blockchain.mempool.startBundling();






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



