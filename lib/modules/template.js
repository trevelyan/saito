


function ModTemplate(app) {

  if (!(this instanceof ModTemplate)) {
    return new ModTemplate(app);
  }

  this.app             = app || {};

  this.name = "";
  this.supportsEmailInterface = 0;

  return this;

}
module.exports = ModTemplate







////////////////////////////
// Extend these Functions // 
////////////////////////////


//
// DISPLAY MESSAGE & ATTACH MESSAGE EVENTS
//
// this formats our transaction information in a way that displays it
// on the screen. In our email client, this is what displays the 
// title and body of the email message when you read the email on 
// the screen.
//
// Attach Events - this attaches the javascript interactive bindings
// to the elements, allowing us to incorporate it with our own library
// and send and receive transactions natively.
//
ModTemplate.prototype.attachEvents = function attachEvents() {}
ModTemplate.prototype.displayMessage = function displayMessage(message_id, app) {

  // by default we just stick the JSON text field into the text element 
  // and display it to the user. This assumes that the content isn't JSON
  // but modules can parse and handle JSON themselves if they really need
  // to do this.
  if (app.BROWSERIFY == 1) {
    message_text_selector = "#" + message_id + " > .json";
    $('#lightbox_message_text').text( $(message_text_selector).text());
  }

}

//
// HANDLE PEER MESSAGE
//
// not all messages sent from peer-to-peer need to be transactions. the 
// underlying software structure supports a number of alternatives, 
// including requests for transmitting blocks, transactions, etc. 
//
// if your web application defines a lower-level massage format, it can 
// send and receive data WITHOUT the need for that data to be confirmed
// in the blockchain. This is useful for applications that are happy to 
// pass data directly, but still want to use the blockchain for peer
// discovery (i.e. "what is your IP address" requests)
//
ModTemplate.prototype.handleDomainRequest = function handleDomainRequest(app, message, peer, mycallback) {}

//
// HANDLE PEER MESSAGE
//
// not all messages sent from peer-to-peer need to be transactions. the 
// underlying software structure supports a number of alternatives, 
// including requests for transmitting blocks, transactions, etc. 
//
// if your web application defines a lower-level massage format, it can 
// send and receive data WITHOUT the need for that data to be confirmed
// in the blockchain. This is useful for applications that are happy to 
// pass data directly, but still want to use the blockchain for peer
// discovery (i.e. "what is your IP address" requests)
//
ModTemplate.prototype.handlePeerRequest = function handlePeerRequest(app, message, peer) {}

//
// AFFIX CALLBACK TO MODULES
//
// sometimes modules want to run callbacks when requests are made that
// trigger other modules. An example is a server that wants to monitor
// AUTH transactions sent through the AUTH module, or a module that
// wants to parse email messages for custom data needs.
//
// in these cases, we check to see if the module returns 1 when the 
// name of the module is submitted in this function. If this function
// is not extended, the onConfirmation function will only be triggered
// in the event of an exact match between the Module Name and the name
// of the module identified in the transaction
//
ModTemplate.prototype.shouldAffixCallbackToModule = function shouldAffixCallbackToModule(modname) {
  if (modname == this.name) { return 1; }
  return 0;
}

//
// DISPLAY USER INPUT FORM
//
// this prepares the HTML form that we use to enter the information
// needed by our module. In the email client this is what displays 
// the title and email inputs into which the users can type their
// email.
//
ModTemplate.prototype.displayUserInputForm = function displayUserInputForm(app) {}


//
// FORMAT TRANSACTION
//
// this is run before we send a transaction into the blockchain. use
// it to grab the content from the HTML form you create and structure
// it as a JSON object, and then insert the JSON object into the 
// message space in the transaction.
//
ModTemplate.prototype.formatTransaction = function formatTransaction(tx, app) {};


//
// INSTALL MODULE
//
// the function is only run the first time the module is loaded on
// a new system. typically we use it to install any custom database
// needed and handle first-time setup work.
//
ModTemplate.prototype.installModule = function installModule(app) {}


//
// ON CONFIRMATION
//
// every time a block receives a confirmation, this function is run.
// by putting custom code in this function, we can have modules take
// arbitrary action when a certain number of confirmations have been
// made to transactions on the network.
//
ModTemplate.prototype.onConfirmation  = function onConfirmation(tx, confnum, app) {}


//
// ADD MESSAGE TO INBOX
//
// this function is run whenever we receive a transaction that contains
// a payment/message for us. It fetches the information from our 
// transaction and puts it into the HTML that is loaded into the 
// browser.
//
// we also run it whenever we load our email screen and input the 
// messages into it which have been saved in our message history.
//
// after the data is put into the browser, the browser can use the 
// information that is in the DOM instead of needing to find and 
// load the transaction from storage again.
//
ModTemplate.prototype.addMessageToInbox = function addMessageToInbox(tx, app) {};


//
// SERVER
//
// this function is run whenever we receive a transaction that contains
// a payment/message for us. It fetches the information from our 
// transaction and puts it into the HTML that is loaded into the 
// browser.
//
// we also run it whenever we load our email screen and input the 
// messages into it which have been saved in our message history.
//
// after the data is put into the browser, the browser can use the 
// information that is in the DOM instead of needing to find and 
// load the transaction from storage again.
//
ModTemplate.prototype.webServer = function webServer(app, expressapp) {};


//
// this callback is run when the HTML has loaded onto the page and
// your web application is starting for the first time.
//
ModTemplate.prototype.initializeHTML = function initializeHTML(app) {};

//
// this callback is run when the module has been installed and is
// ready to initialize anything.
//
ModTemplate.prototype.initialize = function initialize(app) {};

//
// this callback is run whenever the wallet balance is updated
// if your web application needs to display the amount of funds
// in the user wallet, you should hook into this to update your
// display when it changes.
//
ModTemplate.prototype.updateBalance  = function updateBalance(app) {}








