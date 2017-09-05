


const crypto = require("crypto");



var aliceECDH   = crypto.createECDH("secp256k1");
console.log(aliceECDH);
    aliceECDH.generateKeys();

alicePublicKey  = aliceECDH.getPublicKey(null, "compressed");
alicePrivateKey = aliceECDH.getPrivateKey(null, "compressed");


var bobECDH     = crypto.createECDH("secp256k1");
    bobECDH.generateKeys();

bobPublicKey    = bobECDH.getPublicKey(null, "compressed"),
bobPrivateKey   = bobECDH.getPrivateKey(null, "compressed");

var aliceSecret = aliceECDH.computeSecret(bobPublicKey);
var bobSecret   = bobECDH.computeSecret(alicePublicKey);

console.log("Alice Public: ", alicePublicKey.length, alicePublicKey.toString("hex"));
console.log("Alice Private:", alicePrivateKey.length, alicePrivateKey.toString("hex"));
console.log("Bob Public:   ", bobPublicKey.length, bobPublicKey.toString("hex"));
console.log("Bob Private:  ", bobPrivateKey.length, bobPrivateKey.toString("hex"));
console.log("Alice Secret: ", aliceSecret.length, aliceSecret.toString("hex"));
console.log("Bob Secret:   ", bobSecret.length, bobSecret.toString("hex"));


var alice2ECDH   = crypto.createECDH("secp256k1");
console.log(alice2ECDH);
    alice2ECDH.setPrivateKey(alicePrivateKey);
    alice2ECDH.setPublicKey(alicePublicKey);

alice2Secret = alice2ECDH.computeSecret(bobPublicKey);

console.log("Alice2: ", alice2Secret.toString("hex"));






// import node-cryptojs-aes modules to encrypt or decrypt data 
var node_cryptojs = require('node-cryptojs-aes');
 
// node-cryptojs-aes main object; 
var CryptoJS = node_cryptojs.CryptoJS;
 
// custom json serialization format 
var JsonFormatter = node_cryptojs.JsonFormatter;
 
// message to cipher 
var message = "I love maccas!";
var r_pass_base64 = aliceSecret.toString("hex"); 

// encrypt plain text with passphrase and custom json serialization format, return CipherParams object 
// r_pass_base64 is the passphrase generated from first stage 
// message is the original plain text   
 
var encrypted = CryptoJS.AES.encrypt(message, r_pass_base64, { format: JsonFormatter }); 


// convert CipherParams object to json string for transmission 
var encrypted_json_str = encrypted.toString();
 
console.log("serialized CipherParams object: ");
console.log(encrypted_json_str);



            


// decrypt data with encrypted json string, passphrase string and custom JsonFormatter 
var decrypted = CryptoJS.AES.decrypt(encrypted_json_str, r_pass_base64, { format: JsonFormatter });
 
// convert to Utf8 format unmasked data 
var decrypted_str = CryptoJS.enc.Utf8.stringify(decrypted);
 
console.log("decrypted string: " + decrypted_str);





