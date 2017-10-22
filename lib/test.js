var saito = require('./saito');
var app            = {};
    app.BROWSER    = 0;
    app.SPVMODE    = 0;


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
app.modules    = require('./modules/mods')(app);



////////////////
// Initialize //
////////////////
app.storage.initialize();
//
app.wallet.initialize();
// archives before modules
app.archives.initialize();
app.aes.initialize();
app.keys.initialize();
//app.modules.initialize();
// server initialized after modules
// so that the modules can use the
// server to feed their own subpages
// as necessary
//app.server.initialize();
// network before classes that manage specialized peers
//app.network.initialize();
// dns before browser so modules can initialize with dns requests, after ntwork
//app.dns.initialize();
//app.blockchain.initialize();
//app.browser.initialize();


console.log("\n\nUpdating Database\n\n");
console.log(app.wallet.returnPublicKey());

/***
var sql = "SELECT * FROM mod_registry_addresses";
var params = {};
app.storage.queryDatabaseArray(sql,params,function(err,rows) {
  for (var x = 0; x < rows.length; x++) {

    var row = rows[x];

    if (row.signature == "") {

      var msgtosign = row.identifier + row.publickey + row.unixtime;
      var registrysig = app.crypt.signMessage(msgtosign, app.wallet.returnPrivateKey());

      var output = "INSERT OR IGNORE INTO mod_registry_addresses (identifier, publickey, unixtime, signature) VALUES ('"+row.identifier+"','"+row.publickey+"',"+row.unixtime+",'"+registrysig+"');";
      console.log(output);
    }
  }
});
***/


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



