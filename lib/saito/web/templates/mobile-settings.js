var WebTemplate = require('./template');
var util = require('util');


//////////////////
// CONSTRUCTOR  //
//////////////////
function MobileSettings() {
  if (!(this instanceof MobileSettings)) { return new MobileSettings(); }
  MobileSettings.super_.call(this);
  return this;
}
module.exports = MobileSettings;
util.inherits(MobileSettings, WebTemplate);



MobileSettings.prototype.returnHTML = function returnHTML() {
  return ' \
      <input type="button" id="save_wallet" class="settings_button save_wallet" value="Backup Wallet" /> \
      <input type="button" id="import_wallet" class="settings_button import_wallet" value="Import Wallet" /> \
      <input type="button" id="reset_button" class="settings_button reset_button" value="Reset Account" /> \
  ';
}
MobileSettings.prototype.attachEvents = function attachEvents(module_self) {

      $('#mail_controls_settings').off();
      $('#mail_controls_settings').on('click', function() {
	$('#settings_row').toggle();
      });


      $('#save_wallet').off();
      $('#save_wallet').on('click', function() {
	content    = JSON.stringify(module_self.app.options);
        var pom = document.createElement('a');
            pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
            pom.setAttribute('download', "saito.wallet.json");
	    pom.click();
      });


      $('#import_wallet').off();
      $('#import_wallet').on('click', function() {
        document.getElementById('file-input').addEventListener('change', function(e) { 
  	  var file = e.target.files[0];
  	  if (!file) { return; }
	  var reader = new FileReader();
	  reader.onload = function(e) {
	    var contents = e.target.result;
	    tmpoptions = JSON.parse(contents);
	    if (tmpoptions.wallet.publicKey != null) { 
	      module_self.app.options = JSON.parse(contents);
	      module_self.app.storage.saveOptions();
              $.fancybox.close();
	      module_self.showBrowserAlert("Wallet Import Successful");
	    } else {
	      alert("This does not seem to be a valid wallet file");
	    }
	  };
	  reader.readAsText(file);
	  alert("Wallet Loaded");
	  location.reload();
	}, false);
        $('#file-input').trigger('click');
      });


      $('#save_messages').off();
      $('#save_messages').on('click', function() {
	content    = JSON.stringify(module_self.app.options);
        var pom = document.createElement('a');
            pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
            pom.setAttribute('download', "saito.messages.json");
	    pom.click();
      });


      $('#reset_button').off();
      $('#reset_button').on('click', function() {
        module_self.app.storage.saveOptions(1); // 1 = reset to virgin state
        module_self.app.archives.resetArchives();
	alert("Your account has been reset");
	location.reload();
      });

}


