
var saito = require('./saito');
var app            = {};


////////////////////
// Load Variables //
////////////////////
app.crypt      = new saito.crypt();
app.browser    = new saito.browser(app);
app.archives   = new saito.archives(app);
app.storage    = new saito.storage(app);
app.dns        = new saito.dns(app);
app.keys       = new saito.keys(app);
app.wallet     = new saito.wallet(app);
app.network    = new saito.network(app);
app.blockchain = new saito.blockchain(app);
app.server     = new saito.server(app);
app.queue      = new saito.queue(app);
app.modules    = require('./modules/mods')(app);






alice            = app.crypt.createDiffieHellman();
alice_publickey  = alice.getPublicKey(null, "compressed");
alice_privatekey = alice.getPrivateKey(null, "compressed");

bob = app.crypt.createDiffieHellman();
bob_publickey    = bob.getPublicKey(null, "compressed");
bob_privatekey   = bob.getPrivateKey(null, "compressed");

var alice2       = app.crypt.createDiffieHellman(alice_publickey, alice_privatekey);

alice_secret     = app.crypt.createDiffieHellmanSecret(alice, bob_publickey);
bob_secret       = app.crypt.createDiffieHellmanSecret(bob, alice_publickey);
alice2_secret    = app.crypt.createDiffieHellmanSecret(alice2, bob_publickey);


console.log("Alice Public: ", alice_publickey);
console.log("Alice Private:", alice_privatekey);
console.log("Bob Public: ", bob_publickey);
console.log("Bob Private:", bob_privatekey);
console.log("Alice Secret: ", alice_secret);
console.log("Bob Secret:   ", bob_secret);
console.log("Alice2 Secret: ", alice2_secret);

var message_to_encrypt = 'Oh, how many ideas and works had perished in that building —a whole lost culture? Oh, soot, soot, from the Lubyanka chimneys! And the most hurtful thing of all was that our descendants would consider our generation more stupid, less gifted, less vocal than in actual fact it was.';


encrypted = app.crypt.aesEncrypt(message_to_encrypt, alice_secret);

console.log(encrypted);

decrypted = app.crypt.aesDecrypt(encrypted, bob_secret);

console.log(decrypted);




/**


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


****/




