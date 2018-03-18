var eth = require('./eth');
var x = require('./account');

var y = new x();




var account1 = new eth.account();
var account2 = new eth.account();

var accounts = [];
    accounts[0] = account1;
    accounts[1] = account2;





//account1.printKeys();
//account2.printKeys();



console.log(return_initialization_script(accounts));
console.log("\n\n\n");
console.log(return_withdrawal_script(accounts));




function return_initialization_script(accounts) {

  var output = '';

  output += '["';
  output += accounts.length;
  output += '",';

  for (var i = 0; i < accounts.length; i++) {
    output += '"0x000000000000000000000000';
    output += accounts[i].returnPublicKey();
    output += '", ';
  }

  for (var i = 0; i < accounts.length; i++) {
    if (i > 0) { output += ', '; }
    output += '"';
    output += accounts[i].returnInitialCoinDistribution();
    output += '"';
  }

  output += ']';

  return output;

}

function return_withdrawal_script(accounts) {

  var output = '';

  output += '[';

  for (var i = 0; i < accounts.length; i++) {
    output += '"' + accounts[i].returnCurrentCoinDistribution() + '"';
    output += ', ';
    output += '"' + accounts[i].returnCurrentCoinDistribution() + '"';
    output += ', ';
  }

  for (var i = 0; i < accounts.length; i++) {
    output += '"' + accounts[i].returnIndexSigned() + '"';
    output += ', ';
  }

  for (var i = 0; i < accounts.length; i++) {
    if (i > 0) { output += ', '; }
    output += accounts[i].returnMRS();
  }


  output += ']';

  return output;

}











