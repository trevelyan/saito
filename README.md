
Saito is blockchain for big-data applications.

Our goal is supporting a decentralized layer of free-speech applications
like Gmail, Twitter and Facebook on an open-access blockchain that makes
censorship effectively impossible. We achieve the scalability necessary to 
do this by combining a transient blockchain with a security method that 
compensates nodes in the peer-to-peer network for providing bandwidth to 
the network as a whole.

* INSTALLATION *

Saito is programmed in NodeJS. To install a local-only node that 
bootstraps its own blockchain, download Saito, enter the lib directory 
and type:

node start.js

This will start a local node you can access through your browser at:

http://localhost:12100


If you wish to connect to the existing network, edit the file "options" 
to specify the domains name (or IP address) of a peer on the Saito network 
(i.e. saito.tech:12100). In the same file, you can hard-code your domain 
name for your server. This will allow lite-clients to connect to your 
server from anywhere on the Internet.

Most of the user-driven functionality is coded in optional modules that 
create web applications. A good way to get familiar with Saito and find 
out why and how it works is by looking at the modules/mods.js file. Existing 
modules can act as simple tutorials on how to code your own applications.

