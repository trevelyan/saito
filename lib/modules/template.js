


function ModTemplate(app) {

  if (!(this instanceof ModTemplate)) {
    return new ModTemplate(app);
  }

  this.app             = app || {};

  this.name = "";

  return this;

}
module.exports = ModTemplate







////////////////////////////
// Extend these Functions // 
////////////////////////////


//
// DISPLAY MESSAGE
//
// this formats our transaction information in a way that displays it
// on the screen. In our email client, this is what displays the 
// title and body of the email message when you read the email on 
// the screen.
//
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
// DISPLAY USER INPUT FORM
//
// this prepares the HTML form that we use to enter the information
// needed by our module. In the email client this is what displays 
// the title and email inputs into which the users can type their
// email.
//
ModTemplate.prototype.displayUserInputForm = function displayUserInputForm() {}


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








