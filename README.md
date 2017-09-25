

Saito is blockchain for big-data applications.

Our goal is supporting a decentralized layer of free-speech applications
like Gmail, Twitter and Facebook on an open-access blockchain that makes
censorship effectively impossible. We achieve the scalability necessary to 
do this by combining a transient blockchain with a security method that 
compensates nodes in the peer-to-peer network for providing bandwidth to 
the network as a whole.


* STEP 1: INSTALLATION *

Saito is programmed in NodeJS. Please make sure you are running an up-to-
date version of Node (version 8.0 or greater) to avoid problems. Once you
have Node updated, install Saito as you would any other application:

npm install

Saito is configured to connect to the public network by default. If you 
do not wish to make any changes, you can skip down to the point where you
start the software. In the next section, we briefly describe some common
configuration options.



* STEP 2: ALTERNATE CONFIGURATIONS *

If you are experimenting with Saito or development applications for the 
network, it can be convenient to run a local version of the software that
bootstraps its own blockchain instead of connecting to the public network
and downloading the full blockchain. In this case, enter the lib/ directory
and run the command below:

./revertToLocalhost

This will make a number of small changes to the source code that simplify
running your own node. If you want to revert the source code to connect to
the public network you can run this script anytime:

./revertToNetwork

If you are connecting to the public network by are concerned about 
bandwidth you can switch your application to use SPV (lite-client) mode 
by editing the file "start.js" in the lib/ directory so that line four
reads as follows:

    app.SPVMODE    = 1;

Note: if you make ANY changes to the source code, you should recompile
the source code. This will make sure that your updates are passed along 
to any lite-clients that connect through your node. You can do this by
entering the lib/ directory and typing:

./compile  (to purge all blockchain data)
./refresh  (to preserve blockchain data)

Finally, note that many of the configuration settings for Saito are found
in the file lib/options. This file is loaded into Saito when it loads and
tells the software (among other things) to which peers it should connect 
and which servers. 

The simplest options file you can use is: 

{
"server":{"host":"localhost","port":12100,"publickey":""}
}



* STEP 3: USING SAITO *

To run Saito just enter the lib/ directory and start the software:

node start.js

You can now connect to Saito through your browser:

http://localhost:12100

If you are interested in developing the application, you can find the 
default start page for the main server in the source code directory at:

lib/saito/web/index.html

Most of the user-driven functionality is coded in optional modules that 
create web applications. Our blockchain explorer, for instance, is just 
a regular Saito application module (info). The file that controls which 
modules are loaded is:

lib/modules/mods.js

The modules themselves are contained in sub-directories within that 
directory. A good way to get familiar with Saito (and find out how it
works under the hood) is to look at these modules. Existing apps can 
act as simple tutorials on how to code your own applications.

If you have any questions or need help please get in touch:

david@satoshi
david@popupchinese.com





