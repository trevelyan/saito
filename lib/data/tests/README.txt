
These folders contain blockchains that can be used to check that Saito is 
handling different blockchain operations properly. Remember to preserve
file timestamps when copying the directories into the default block-save
directory, i.e.:

  // remove existing directory
  rm -rf ./blocks

  // recursive copy PRESERVING timestamps
  cp -r -p ./tests/reorg ./blocks


reorg1:
- 4 blocks written on first chain
- 3 blocks written (3-5) from block 2
- reoganization happens



