# Install Saito


## Server Configuration (pre-install)

You should have a server with at least 2 GB of RAM and a reasonably 
up-to-date version of NodeJS and NPM installed. If you are setting
up a new server, we recommend using Ubuntu, which can be configured
to work out-of-the-box with Node v9 as follows:
```
apt-get update
apt-get install g++ make
curl -sL https://deb.nodesource.com/setup_9.x | sudo -E bash -
sudo apt-get install -y nodejs
```



## Step 1 - Google's Dense Hashmap implementation

Download Google's Dense Hashmap implementation:
```
git clone https://github.com/sparsehash/sparsehash
cd sparsehash
./configure
make
make install
```

If you cannot download this file, we have included a recent working
version inside the "extras" directory in this distribution. You can 
install it by entering the relevant directory and installing it:
```
cd extras/sparsehash/sparsehash
./configure
make
make install
```



## Step 2 - required NodeJS

Install required NodeJS dependencies:
```
npm install
```

If you run into any problems at this point please write us and let us
know and we'll figure out the problem and update this file. Otherwise
you should be ready to run Saito.



## Step 3 - Run Saito

Go into the lib directory where our `start.js` script is found
```
cd lib/
```

And run our `compile` script to refresh the software to a clean state
for the first time it will run. Then:
```
node start.js
```

This will start a version of Saito running on LOCALHOST. When we launch
our testnet we will change this package to connect to testnet by default.
Until then, connecting to the testnet needs to be manually enabled, but 
the local version can still be used for testing and app development.

If you wish to run Saito on a server and close your connection to the 
server while continuing to run Saito in background mode, enter this
command instead:
```
nohup node --max_old_space_size=4144 start.js > saito.log 2 > saito.err &
```

Wait a few seconds after starting the program and type `Ctrl-C`. You
will see the `^C` carat printed at the terminal line but get no other
indications of change. You should then type `exit` to close your 
terminal. Saito will continue to run in the background.
