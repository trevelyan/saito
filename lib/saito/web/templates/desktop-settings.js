var WebTemplate = require('./template');
var util = require('util');


//////////////////
// CONSTRUCTOR  //
//////////////////
function DesktopSettings() {
  if (!(this instanceof DesktopSettings)) { return new DesktopSettings(); }
  DesktopSettings.super_.call(this);
  return this;
}
module.exports = DesktopSettings;
util.inherits(DesktopSettings, WebTemplate);



DesktopSettings.prototype.returnHTML = function returnHTML() {
  return ' \
<b>Basic Settings</b> \
\
<p></p> \
\
This is your wallet. You should backup this information: \
\
    <p></p> \
\
    <table style="margin-left: 25px;"> \
      <tr> \
        <td style="margin-right: 10px;font-weight:bold;">Public Key</td> \
	<td id="lightbox_viewkeys_publickey"></td> \
      </tr> \
      <tr> \
        <td style="margin-right: 10px;font-weight:bold;">Private Key</td> \
	<td id="lightbox_viewkeys_privatekey"></td> \
      </tr> \
      <tr> \
        <td style="margin-right: 10px;font-weight:bold;">Address</td> \
	<td id="lightbox_viewkeys_identifier" style="cursor:pointer">unregistered</td> \
      </tr> \
    </table> \
\
    <p style="clear:both"></p> \
\
    <input type="button" id="save_wallet" class="settings_button save_wallet" value="Backup Wallet" /> \
    <input type="button" id="save_messages" class="settings_button save_messages" value="Backup Inbox" /> \
    <input type="button" id="import_wallet" class="settings_button import_wallet" value="Import Wallet" /> \
    <input type="button" id="import_messages" class="settings_button import_messages" value="Import Inbox" /> \
    <input type="button" id="reset_button" class="settings_button reset_button" value="Reset Account" /> \
    <input type="button" id="restore_privatekey" class="settings_button restore_privatekey" value="Restore Wallet from Private Key" /> \
    <input id="file-input" type="file" name="name" style="display:none;" /> \
\
    <p style="clear:both;margin-top:30px;"></p> \
\
    <div style="display:none" id="restore_privatekey_div"> \
\
      <label for="restore_privatekey_input">Your Private Key:</label> \
\
      <br /> \
\
      <input type="text" name="restore_privatekey_input" id="restore_privatekey_input" class="restore_privatekey_input" /> \
\
      <br /> \
\
      <input type="submit" id="restore_privatekey_submit" value="Import Private Key" class="restore_privatekey_submit" /> \
\
      <p style="clear:both;margin-top:30px;"></p> \
\
    </div> \
\
    <b>DNS Information</b> \
\
    <p></p> \
\
    You are connected to the following DNS servers. You can also sync your own directly off the blockchain: \
\
    <div class="dns_servers" id="dns_servers"> \
      <table id="dns_servers_table" class="dns_servers_table" style="margin-left: 25px"> \
        <tr> \
          <th style="padding-right:25px;" align="left">Domain</th> \
          <th style="padding-right:25px;" align="left">Server</th> \
          <th style="padding-right:25px;" align="left">Public Key</th> \
        </tr> \
      </table> \
    </div> \
';
}
DesktopSettings.prototype.attachEvents = function attachEvents(module_self) {


      $('#restore_privatekey').off();
      $('#restore_privatekey').on('click', function() {
        $('#restore_privatekey_div').toggle();
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


      $('#import_messages').off();
      $('#import_messages').on('click', function() {
        document.getElementById('file-input').addEventListener('change', function(e) { 
  	  var file = e.target.files[0];
  	  if (!file) { return; }
	  var reader = new FileReader();
	  reader.onload = function(e) {
	    var contents = e.target.result;
	    module_self.app.archives.resetArchives();
            tmpmessages = JSON.parse(contents);
	    if (tmpmessages.messages.length != null) { 
  	      for (xx = 0; xx < tmpmessages.length; xx++) {
	        module_self.app.archives.saveMessage(tmpmessages[xx]);
	      }
            } else {
	      alert("Error: this is not a valid inbox backup");
	    }
	  };
	  reader.readAsText(file);
	}, false);
        $('#file-input').trigger('click');
      });


      $('#save_messages').off();
      $('#save_messages').on('click', function() {
	content    = JSON.stringify(module_self.app.archives.messages);
        var pom = document.createElement('a');
            pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
            pom.setAttribute('download', "saito.messages.json");
	    pom.click();
      });


      $('#reset_button').off();
      $('#reset_button').on('click', function() {
        module_self.app.archives.resetArchives();
        module_self.app.storage.saveOptions(1); // 1 = reset to virgin state
	alert("Your account has been reset");
	location.reload();
      });


      $('#mail_controls_settings').off();
      $('#mail_controls_settings').on('click', function() {
        $.fancybox({
          href            : '#saito-desktop-settings',
          fitToView       : false,
          width           : '1000px',
          height          : '600px',
          closeBtn        : true,
          autoSize        : false,
          closeClick      : false,
          openEffect      : 'none',
          closeEffect     : 'none',
          helpers: {
            overlay : {
              closeClick : false
            }
          },
          keys : {
            close : null
          },
	  afterShow : function() {

            // customize dns settings display
            $('#dns_servers_table tr').empty();
            for (c = 0; c < module_self.app.dns.dns.domains.length; c++) {
              var tmphtml = '<tr><th align="left" style="padding-right:25px;">Domain</th><th align="left" style="padding-right:25px">Host</th><th align="left">Public Key</th></tr>';
              $('#dns_servers_table').append(tmphtml);
              var dnsurl = "unknown";
              for (cvs = 0; cvs < module_self.app.network.peers.length; cvs++) {
                if (module_self.app.dns.dns.domains[c].publickey == module_self.app.network.peers[cvs].peer.publickey) {
	          dnsurl = module_self.app.network.peers[cvs].peer.host;
                  tmphtml = '<tr><td>'+module_self.app.dns.dns.domains[c].domain+'</td><td>'+dnsurl+'</td><td>'+module_self.app.dns.dns.domains[c].publickey+'</td></tr>';
                  $('#dns_servers_table tr:last').after(tmphtml);
	        }
              }
              if (dnsurl == "unknown") {
                tmphtml = '<tr><td style="padding-right:14px;">'+module_self.app.dns.dns.domains[c].domain+'</td><td style="padding-right:14px;">UNKNOWN</td><td style="padding-right:14px;">PUBLIC KEY OUT-OF-DATE</td></tr>';
                $('#dns_servers_table tr:last').after(tmphtml);
	      }
            };


	    $('#restore_privatekey_submit').off();
	    $('#restore_privatekey_submit').on('click', function() {

	      var privkey = $('#restore_privatekey_input').val();
              privkey.trim();
		
	      var pubkey = module_self.app.crypt.returnPublicKey(privkey);

	      if (pubkey != "") {

		module_self.app.dns.fetchIdFromAppropriateServer(module_self.app.wallet.returnPublicKey(), function (answer) {

	          if (module_self.app.dns.isRecordValid(answer) == 0) {
		    alert("Cannot find registered email address. Restoring public and private keys only");
		    return;
	          }

        	  dns_response = JSON.parse(answer);

        	  if (dns_response.identifier != "") {
        	    if (dns_response.publickey != "") {
        	      module_self.app.keys.addKey(dns_response.publickey, dns_response.identifier, 0, "Email");
        	      module_self.app.keys.saveKeys();
        	      module_self.app.wallet.updateIdentifier(dns_response.identifier);
        	      module_self.app.wallet.saveWallet();
        	    }
        	  }

		  // regardless of whether we got an identifier, save
		  module_self.app.wallet.wallet.utxi = [];
		  module_self.app.wallet.wallet.utxo = [];
		  module_self.app.wallet.wallet.privateKey = privkey;
		  module_self.app.wallet.wallet.publicKey  = pubkey;

          	  module_self.app.options.blockchain.lastblock = 0;
          	  module_self.app.storage.saveOptions();
          	  module_self.app.wallet.saveWallet();

		  alert("Your Wallet and Email Address Restored!");
		  location.reload();
      	        });

	      }
	    });



	    // update identifier
	    if (module_self.app.wallet.returnIdentifier() != "") {
	      $('#lightbox_viewkeys_identifier').text(module_self.app.wallet.returnIdentifier());
            }

	  }
        });
      });

}



