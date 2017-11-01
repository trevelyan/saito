
var keythereum = require("keythereum");


console.log("Hello Wprld");

































function generateEthereumKeys() {

  var params = { keyBytes: 32, ivBytes: 16 };
  var dk = keythereum.create(params);
  var options = {
    kdf: "pbkdf2",
    cipher: "aes-128-ctr",
    kdfparams: {
      c: 262144,
      dklen: 32,
      prf: "hmac-sha256"
    }
  };

  var password = "ethereum";
  //var keyObject = keythereum.dump(password, dk.privateKey, dk.salt, dk.iv, options);
  var keyObject = keythereum.dump(password, dk.privateKey, dk.salt, dk.iv);

  var keys = {};
      keys.public  = "0x" + keyObject.address;
      keys.private = keythereum.recover(password, keyObject).toString('hex');

  return keys;

}









