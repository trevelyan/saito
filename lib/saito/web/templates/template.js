
function WebTemplate() {
  if (!(this instanceof WebTemplate)) {
    return new WebTemplate();
  }
  return this;
}
module.exports = WebTemplate


////////////////////////////
// Extend these Functions // 
////////////////////////////

//
// Returns HTML
//
WebTemplate.prototype.returnHTML = function returnHTML() {}

//
// Attach Events
//
WebTemplate.prototype.attachEvents = function attachEvents() {};

