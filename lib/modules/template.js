


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
ModTemplate.prototype.installModule = function installModule(app) {}
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
ModTemplate.prototype.displayUserInputForm = function displayUserInputMessage() {}
ModTemplate.prototype.onConfirmation  = function onConfirmation(tx, confnum, app) {}


