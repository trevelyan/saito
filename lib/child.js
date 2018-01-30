var saito = require('./saito');

var app            = {};
    app.BROWSER    = 0;
    app.SPVMODE    = 0;


////////////////
// Initialize //
////////////////
app.crypt          = new saito.crypt();
app.storage        = new saito.storage(app);
app.storage.dbname = "./data/" + Math.floor(Math.random()*1000000) + ".sq3";
app.storage.initialize();



process.on('message', (msg) => {

  if (msg.saveBlock != undefined) {
    var blk          = msg.saveBlock;
    var child_number = msg.child_number;
    var max_children = msg.max_children;
    var lc           = msg.lc;
    var nb           = new saito.block(app, blk);
    app.storage.saveBlock(nb, lc, 1, child_number, max_children);
  }



  if (msg.validateBlock != undefined) {

    var blk            = msg.validateBlock;
    var block_id       = msg.block_id;
    var block_hash     = msg.block_hash;
    var child_number   = msg.child_number;
    var max_children   = msg.max_children;
    var chain_hash_sql = msg.chain_hash_sql;
    var old_lc         = msg.old_lc;
    var lc_len         = msg.lc_len;
    var forceAdd       = msg.forceAdd;
    var nb             = new saito.block(app, blk);
    nb.block.transactions = JSON.parse(msg.txs_json);

    for (var i = 0; i < nb.block.transactions.length; i++) {

      for (var j = 0; j < nb.block.transactions[i].transaction.from.length; j++) {
        if (child_number != app.storage.returnChildForkForSlip(nb.block.transactions[i].transaction.from[j])) {
	  // -99 is a value we check for in our storage class to see if this is a fee we do not process
          nb.block.transactions[i].transaction.from[j].amt = -99;
	}
      }

    }

    app.storage.bhash_to_validate = block_hash;
    app.storage.validateInputsChildProcess(nb, block_id, chain_hash_sql, old_lc, lc_len, forceAdd);

  }


});





