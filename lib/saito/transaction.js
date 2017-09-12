var saito         = require('../saito');

function Transaction(txjson="") {

  if (!(this instanceof Transaction)) {
    return new Transaction(txjson);
  }


  ////////////////////////
  // included in blocks //
  ////////////////////////
  this.transaction               = {};    // * = validated
  this.transaction.from          = [];    // * (payslips)
  this.transaction.to            = [];    // * (payslip)
  this.transaction.ts            = "";    // * unixtime
  this.transaction.sig           = "";    //   sig of tx
  this.transaction.ver           = 1.0;
  this.transaction.path          = [];    // transaction path
  this.transaction.id            = 1;
  this.transaction.gt            = null;  // * golden ticket
  this.transaction.msg           = {};    //
  this.transaction.msig          = "";    // * sig of msg
  this.transaction.ps            = 0;     // * paysplit vote


  ////////////////////////////
  // not included in blocks //
  ////////////////////////////
  this.usable_fee                = -1;
  this.fee                       = -1;


  ///////////////////////
  // import JSON slips //
  ///////////////////////
  if (txjson != "") {
    this.transaction = JSON.parse(txjson);

    if (this.transaction.from == null) { this.transaction.from = []; }
    if (this.transaction.to == null)   { this.transaction.to = []; }

    for (txi = 0; txi < this.transaction.from.length; txi++) {
      this.transaction.from[txi] = new saito.slip(this.transaction.from[txi].add, this.transaction.from[txi].amt, this.transaction.from[txi].gt, this.transaction.from[txi].bid, this.transaction.from[txi].tid, this.transaction.from[txi].sid, this.transaction.from[txi].bhash, this.transaction.from[txi].lc);
    }
    for (txi = 0; txi < this.transaction.to.length; txi++) {
      this.transaction.to[txi] = new saito.slip(this.transaction.to[txi].add, this.transaction.to[txi].amt, this.transaction.to[txi].gt, this.transaction.to[txi].bid, this.transaction.to[txi].tid, this.transaction.to[txi].sid, this.transaction.to[txi].bhash, this.transaction.to[txi].lc);
    }
  }


  return this;

}
module.exports = Transaction;






Transaction.prototype.debugHTML = function debugHTML() {

  html  = '<table class="transactions_table">';
  html += '<tr><td>id</td><td>'+this.transaction.id+'</td></tr>';
  html += '<tr><td>from</td><td><pre><code>'+JSON.stringify(this.transaction.from, null, 4)+'</code></pre></td></tr>';
  html += '<tr><td>to</td><td><pre><code>'+JSON.stringify(this.transaction.to, null, 4)+'</code></pre></td></tr>';
  html += '<tr><td>unixtime</td><td>'+this.transaction.ts+'</td></tr>';
  html += '<tr><td>signature</td><td>'+this.transaction.sig+'</td></tr>';
  html += '<tr><td>version</td><td>'+this.transaction.ver+'</td></tr>';
  html += '<tr><td>path</td><td><pre><code>'+JSON.stringify(this.transaction.path, null, 4)+'</code></pre></td></tr>';
  if (this.transaction.gt != null) {
    html += '<tr><td>golden ticket</td><td><pre><code>'+JSON.stringify(this.transaction.gt, null, 4)+'</pre></code></td></tr>';
  } else {
    html += '<tr><td>golden ticket</td><td></td></tr>';
  }
  html += '<tr><td>message</td><td><pre><code>'+JSON.stringify(this.transaction.msg, null, 4)+'</code></pre></td></tr>';
  html += '<tr><td>paysplit vote</td><td>'+this.transaction.ps+'</td></tr>';
  html += '</table>';

  return html;

}








//////////////
// Validate //
//////////////
Transaction.prototype.validate = function validate(app) {

  // check that we have at last one sender and receiver
  if (this.transaction.from.length < 1) { 
    console.log("no from address in transaction");
    return 0;
  }
  if (this.transaction.to.length < 1) { 
    console.log("no to address in transaction");
    return 0;
  }

  if (!saito.crypt().verifyMessage(this.signatureSource(),this.transaction.sig,this.returnSender())) {
    console.log("transaction signature does not verify");
    return 0;
  }

  if (!saito.crypt().verifyMessage(this.transaction.msg,this.transaction.msig,this.returnSender())) {
    console.log("transaction message signature does not verify");
    return 0;
  }

  return 1;

}
Transaction.prototype.validateInputs = function validateInputs(app, blk=null) {

  // does the sender have enough cash? are the inputs valid?
  if (this.transaction.from == null) { return; }
  for (utxii = 0; utxii < this.transaction.from.length; utxii++) {
    tx = this;
    app.storage.validateInputWithCallbackOnFailure(tx, this.transaction.from[utxii], function(app, tx, badslip) {

console.log("\n\nWE HAVE A FAILED TRANSACTION: ");
console.log(tx);
console.log(" ... the bad slip is: ");
console.log(badslip);

      if (blk == null) {
	app.blockchain.mempool.removeTransaction(tx);
      } else {
	app.blockchain.mempool.removeTransaction(tx);
        app.blockchain.deIndexAndPurge(blk);
      }
    });
  }

  return 1;

}
Transaction.prototype.validateInputsWithCallbackOnSuccess = function validateInputsWithCallbackOnSuccess(app, mycallback) {

console.log("validate inputs with cb on success...");

  // does the sender have enough cash? are the inputs valid?
  if (this.transaction.from == null) { return; }
  app.storage.validateInputsWithCallbackOnSuccess(tx, this.transaction.from, function(app, tx) {
    mycallback(app, tx);
  });

  return 1;

}




Transaction.prototype.signatureSource = function signatureSource() {
  return        JSON.stringify(this.transaction.from) +
                JSON.stringify(this.transaction.to) +
                this.transaction.ts +
                this.transaction.ps +
                JSON.stringify(this.transaction.gt) +
                JSON.stringify(this.transaction.msig);
}



Transaction.prototype.signTransaction = function signTransaction() {
  this.transaction.msig   = this.signMessage(this.transaction.msg);
  this.transaction.sig  = this.signMessage(this.signatureSource());
}
Transaction.prototype.signMessage = function signMessage(message) {
  return saito.crypt().signMessage(message, this.app.wallet.returnPrivateKey());
}
Transaction.prototype.addTo = function addTo(toAddress, toAmount) {
  this.to.push(new saito.slip(toAddress, toAmount));
}
Transaction.prototype.addFrom = function addFrom(fromAddress, fromAmount) {
  this.from.push(new saito.slip(fromAddress, fromAmount));
}
Transaction.prototype.isFrom = function isFrom(senderPublicKey) {
  if (this.returnSlipsFrom(senderPublicKey).length != 0) { return 1; }
  return 0;
}
Transaction.prototype.isTo = function isTo(receiverPublicKey) {
  if (this.returnSlipsTo(receiverPublicKey).length != 0) { return 1; }
  return 0;
}
Transaction.prototype.involvesPublicKey = function involvesPublicKey(publickey) {
  if (this.returnSlipsFrom(publickey).length > 0 || this.returnSlipsTo(publickey).length > 0 ) { return 1; }
  return 0;
}



// if is encrypted and for us, we decrypt
Transaction.prototype.decryptMessage = function decryptMessage(app) {

  // avoids errors decrypting non-encrypted content
  try {
    tmpx = app.aes.decryptMessage(this.transaction.from[0].add, this.transaction.msg);
    this.transaction.msg = tmpx;
  } catch (e) {}

  return;
}





Transaction.prototype.returnSlipsTo = function returnSlipsTo(toAddress) {
  x = [];
  if (this.transaction.to != null) {
    for (v = 0; v < this.transaction.to.length; v++) {
      if (this.transaction.to[v].add == toAddress) { x.push(this.transaction.to[v]); }
    }
  }
  return x;
}
Transaction.prototype.returnSlipsFrom = function returnSlipsFrom(fromAddress) {
  x = [];
  if (this.transaction.from != null) {
    for (v = 0; v < this.transaction.from.length; v++) {
      if (this.transaction.from[v].add == fromAddress) { x.push(this.transaction.from[v]); }
    }
  }
  return x;
}
Transaction.prototype.returnAmountTo = function returnAmountTo(toAddress) {
  x = 0.0;
  if (this.transaction.to != null) {
    for (v = 0; v < this.transaction.to.length; v++) {
      if (this.transaction.to[v].add == toAddress) {
        if (this.transaction.to[v].amt > 0) { x = parseFloat(x) + parseFloat(this.transaction.to[v].amt); }
      }
    }
  }
  return x;
}

// check the actual fees paid from the perspective of the
// node that is going to bundle this into a block. This
// is not the total amount of money in the transaction
// but rather the amount after network transmission
// is paid for out-of-pocket.
Transaction.prototype.returnUsableFee = function returnUsableFee() {

  if (this.usable_fee == -1 || this.usable_fee == null) {

    // we haven't calculated the fee for this transaction yet
    // so we do it, and save it to a local variable so we don't
    // need to do this computationally intensive work in the
    // future.

    inputs = 0.0;
    if (this.transaction.from != null) {
      for (v = 0; v < this.transaction.from.length; v++) {
        inputs = parseFloat(inputs) + parseFloat(this.transaction.from[v].amt);
      }
    }
    outputs = 0.0;
    for (v = 0; v < this.transaction.to.length; v++) {
      // only count outputs on non-gt transactions
      if (this.transaction.to[v].gt != 1) {
        outputs = parseFloat(outputs) + parseFloat(this.transaction.to[v].amt);
      }
    }

    this.fee = (inputs - outputs);
    this.usable_fee = this.fee;

    pathlength = this.returnPathLength();

    for (x = 1; x < pathlength; x++) {
      this.usable_fee = this.fee/2;
      this.usable_fee.toFixed(8);
    }

    return this.usable_fee;
  } else {
    return this.usable_fee;
  }

}
Transaction.prototype.returnFee = function returnFee() {

  if (this.fee == -1 || this.fee == null) {

    // we haven't calculated the fee for this transaction yet
    // so we do it, and save it to a local variable so we don't
    // need to do this computationally intensive work in the
    // future.

    inputs = 0.0;
    for (v = 0; v < this.transaction.from.length; v++) {
      inputs = parseFloat(inputs) + parseFloat(this.transaction.from[v].amt);
    }

    outputs = 0.0;
    for (v = 0; v < this.transaction.to.length; v++) {
      // only count outputs on non-gt transactions
      if (this.transaction.to[v].gt != 1) {
        outputs = parseFloat(outputs) + parseFloat(this.transaction.to[v].amt);
      }
    }

    this.fee = (inputs - outputs);
  }

  return this.fee;

}








Transaction.prototype.returnTransactionJson = function returnTransactionJson() {
  return JSON.stringify(this.returnTransaction());
}
Transaction.prototype.returnTransaction = function returnTransaction() {
  return this.transaction;
}
Transaction.prototype.returnPathLength = function returnPathLength() {
  return this.transaction.path.length;
}
Transaction.prototype.returnSender = function returnSender() {
  if (this.transaction.from.length >= 1) {
    return this.transaction.from[0].add;
  }
}



