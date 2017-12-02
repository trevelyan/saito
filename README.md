

Saito is blockchain for big-data applications.

Our goal is supporting a decentralized layer of free-speech applications
like Gmail, Twitter and Facebook on an open-access blockchain that makes
censorship effectively impossible. We achieve the scalability to do this 
by combining a transient blockchain with a security method that 
compensates nodes in the peer-to-peer network for providing bandwidth to 
the network as a whole.


* STEP 1: INSTALLATION *

Saito is programmed in NodeJS. Please make sure you are running an up-to-
date version of Node (version 8.0 or greater) to avoid problems. Once you
have Node updated, install Saito as you would any other application:

npm install

If you get any warning messages about uninstalled modules, just run the 
standard re-installation command. The two modules that I seem to need to 
manually install are:

npm install keythereum
npm install sqlite3


* STEP 2: ALTERNATE CONFIGURATIONS *

If you are connecting to the public network by are concerned about 
bandwidth you can switch your application to use SPV (lite-client) mode 
by editing the file "start.js" in the lib/ directory so that line four
reads as follows:

    app.SPVMODE    = 1;

Note: if you make ANY changes to the source code, you should recompile
the source code to recreate the javascript file that will be given to 
lite-clients that connect to your server. You can do this by entering 
the lib/ directory and typing:

./compile  (to purge all blockchain data)
./refresh  (to preserve blockchain data)

Finally, note that many of the configuration settings for Saito are found
in the file lib/options. This file is loaded into Saito when it loads and
tells the software (among other things) to which peers it should connect 
and how much money it has in its wallet, etc. 

The simplest options file you can use is: 

{
"server":{"host":"localhost","port":12100,"publickey":""}
}



* STEP 3: USING SAITO *

To run Saito just enter the lib/ directory and start the software:

node start.js

node --max_old_space_size=6144 start.js



If you want to run Saito from the command-line and have the program
continue to operate when you disconnect from the server or close 
your terminal, you can stick Saito into the background by going to
the /lib directory and typing:

nohup node start.js > saito.log 2> saito.err &

Wait a few seconds and then hit "Cntl-C" (you will see the ^C 
command printed at the terminal but get no other indication of any
changes). Then type "exit" to close your terminal. Saito will now 
continue running in the background -- note that if you do not hit 
Cntl-C and/or do not type exit the program will close when you close
your terminal window or disconnect from the server.

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





