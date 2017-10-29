
var ethKeys = require("ethereumjs-keys"); 
var password = "ethereum";
var kdf = "pbkdf2";
var dk = ethKeys.create();
var json = ethKeys.dump(password, dk.privateKey, dk.salt, dk.iv, kdf);


console.log(json);




