var saito = require('../saito');


function Browser(app) {

  if (!(this instanceof Browser)) {
    return new Browser(app);
  }

  this.app = app || {};

  return this;

}
module.exports = Browser;




// we want to tag modules with "browser_active" before 
// they initialize, so this specific class has a special
// initialization function
Browser.prototype.pre_module_initialize = function pre_module_initialize() {

    if (this.app.BROWSER == 0) { return; }

    // get the variable browser_active to 1 only on the modules we are interacting
    // with through the browser. This lets us avoid running significant bits of 
    // javascript for modules that are not interacting with the DOM
    for (var mc = 0; mc < this.app.modules.mods.length; mc++) {
      var divhunt = "#" + this.app.modules.mods[mc].name + "_browser_active";
      if ($(divhunt).length > 0) {
        this.app.modules.mods[mc].browser_active = 1;
      }
    }

}

Browser.prototype.initialize = function initialize() {
    if (this.app.BROWSER == 0) { return; }

    this.app.modules.initializeHTML();
    this.app.modules.attachEvents();
}





