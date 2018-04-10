
This module is used by Saito to create and interact with a Google Dense Hashmap. In order for it to work you will need to have already installed the Google Sparsehash library. If you have not done this, you can take care of it as follows:

Download Google's Dense Hashmap implementation:

    git clone https://github.com/sparsehash/sparsehash
    cd sparsehash
    ./configure
    make
    make install

If you cannot download this file, we have included a recent working version inside the "extras" directory of the Saito distribution. You can install it by downloading Saito and entering the relevant directory and installing it manually:

    git clone https://github.com/trevelyan/saito
    cd saito/extras/sparsehash/sparsehash
    ./configure
    make
    make install

Once that is done, this module should install without complaint.


To compile, run

```
npm build .
```


