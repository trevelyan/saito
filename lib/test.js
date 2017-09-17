var bloom = require('./saito/bloom.js');

var app            = {};
    app.BROWSER    = 0;
    app.SPVMODE    = 0;





console.log("\nWelcome to the Test:\n");



var b = new bloom(28 * 1024 * 1024, 33, 0xdeadbee0);
    b.add("afa4eb347424d8937f78873629bab7fc8bd29ea9d2e84db2d6d2ef2be747a294", 'hex');
    b.add("bfa4eb347424d8937f78873629bab7fc8bd29ea9d2e84db2d6d2ef2be747a294", 'hex');
    b.add("cfa4eb347424d8937f78873629bab7fc8bd29ea9d2e84db2d6d2ef2be747a294", 'hex');
    b.add("dfa4eb347424d8937f78873629bab7fc8bd29ea9d2e84db2d6d2ef2be747a294", 'hex');
    b.add("efa4eb347424d8937f78873629bab7fc8bd29ea9d2e84db2d6d2ef2be747a294", 'hex');
c = b.test("afa4eb347424d8937f78873629bab7fc8bd29ea9d2e84db2d6d2ef2be747a294", 'hex');
console.log("TESTING: "+c);
c = b.test("ffa4eb347424d8937f78873629bab7fc8bd29ea9d2e84db2d6d2ef2be747a294", 'hex');
console.log("TESTING: "+c);





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



