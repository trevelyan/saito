var saito = require('../saito');
var fs    = require('fs');


function Browser(app) {

  if (!(this instanceof Browser)) {
    return new Browser(app);
  }

  this.app = app || {};

  return this;

}
module.exports = Browser;



Browser.prototype.attachTemplateEvents = function attachTemplateEvents(template_name, module_self) {

  if (this.app.BROWSER != 1) { return; }

  if (template_name == "saito-desktop-settings") {
    var sds = new saito.templates.desktopSettings();
    sds.attachEvents(module_self);
  }

  if (template_name == "saito-mobile-settings") {
    var sms = new saito.templates.mobileSettings();
    sms.attachEvents(module_self);
  }

}
Browser.prototype.initialize = function initialize() {

    if (this.app.BROWSER == 0) { return; }

    // set the browser_active variable to 1 for modules we 
    // are interacting with. This avoids running unnecessary
    // interface code that might conflict in DOM management
    for (var m = 0; m < this.app.modules.mods.length; m++) {
      var divhunt = "#" + this.app.modules.mods[m].name + "_browser_active";
      if ($(divhunt).length > 0) {
        this.app.modules.mods[m].browser_active = 1;
      }
    }

    // .. and setup
    this.app.modules.initializeHTML();
    this.app.modules.attachEvents();

}
Browser.prototype.insertTemplateHTML = function insertTemplateHTML(template_name) {

  if (this.app.BROWSER != 1) { return; }

  if (template_name == "saito-desktop-settings") {
    var sds = new saito.templates.desktopSettings();
    $('#saito-desktop-settings').html(sds.returnHTML());
  }

  if (template_name == "saito-mobile-settings") {
    var sms = new saito.templates.mobileSettings();
    $('#saito-mobile-settings').html(sms.returnHTML());
  }

}


