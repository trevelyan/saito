var ethutil    = require("ethereumjs-util");
var keythereum = require("keythereum");



function Account() {

  if (!(this instanceof Account)) {
    return new Account();
  }

  this.params = { keyBytes: 32, ivBytes: 16 };
  this.dk = keythereum.create(this.params);
  this.options = {
    kdf: "pbkdf2",
    cipher: "aes-128-cbc",
    kdfparams: {
      c: 262144,
      dklen: 32,
      prf: "hmac-sha256"
    }
  };


  this.password = "ethereum";
  this.keyObject = keythereum.dump(this.password, this.dk.privateKey, this.dk.salt, this.dk.iv, this.options);

  this.keys = {};
  this.keys.public  = this.keyObject.address;
  this.keys.private = keythereum.recover(this.password, this.keyObject).toString('hex');


  this.units_per_ethereum        = 1000000000000000000;
  this.initial_coin_distribution = 1000000000000000000;
  this.current_coin_distribution = 1000000000000000000;
  this.index_signed              = 0;

  return this;

}
module.exports = Account;



Account.prototype.initialize = function initialize(coin_dist) {

//  var msg  = "" + desired_coin_distribution + index_signed;
//  var msg_s = signMessage(keys, msg);

}


Account.prototype.setCoinDistribution = function setCoinDistribution(adjustment) {
  this.current_coin_distribution += adjustment;
  return this.current_coin_distribution;
}


Account.prototype.returnPublicKey = function returnPublicKey() {
  return this.keys.public;
}
Account.prototype.returnIndexSigned = function returnIndexSigned() {
  return this.index_signed;
}
Account.prototype.returnInitialCoinDistribution = function returnInitialCoinDistribution() {
  return this.initial_coin_distribution;
}
Account.prototype.returnCurrentCoinDistribution = function returnCurrentCoinDistribution() {
  return this.current_coin_distribution;
}
Account.prototype.returnMRS = function returnMRS(message) {

  var output = '';
  var msg    = "" + this.returnCurrentCoinDistribution() + this.returnIndexSigned();
  var msg_s  = this.signMessage(this.keys, msg);

  output += '"0x'+ethutil.sha256(msg).toString('hex') + '", "0x'+msg_s.r.toString('hex')+'", "0x'+msg_s.s.toString('hex')+'"';

  return output;

}
Account.prototype.printKeys = function printKeys() {
  console.log(this.keys);
}
Account.prototype.signMessage = function signMessage(keys, msg) {

  var privk = "0x"+keys.private;

  var msg_b     = ethutil.sha256(msg);
  var privkey_b = ethutil.toBuffer(privk);
  var msg_s     = ethutil.ecsign(msg_b, privkey_b);

  return msg_s;

}




