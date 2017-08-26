Saito is blockchain for big-data applications.

Out goal is supporting a decentralized set of free-speech web applications (Gmail, Twitter, Facebook, etc.) on 
an open-access blockchain that makes censorship of free-speech impossible to maintain. We achieve the 
scalability necessary for these applications by combining a transient blockchain with a security method that 
rewards the nodes in the peer-to-peer network for bandwidth provision.

* INSTALLATION *

Saito is programmed in NodeJS. To install a local-only node that bootstraps its own blockchain, download Saito, 
go to the lib/ directory, and type:

node start.js

This will start a local node you can access through your browser at:

http://localhost:12100

Most of the user-driven functionality is coded in optional modules that extend the main application. A good way
to get familiar with Saito and find out why and how it works is by looking at the modules/mods.js file. Existing 
modules can act as simple tutorials on how to code your own applications.

If you wish to connect to the existing network, edit the file "options" to specify the domains name (or IP 
address) of a peer on the Saito network (i.e. saito.tech:12100). If you are running your node on a server with 
an identifiable domain name, you should provide that domain name in the "server" field of the options file and 
it will help clients connect to your server (instead of localhost). Once a browser has connected to your server
you can see the options file being served to them at:

lib/saito/web/client.options

Domain and Archiving servers are simply applications that sit on the blockchain and read/write requests. Look 
at the specific modules that power those applications if you are interested in setting up your own service.

