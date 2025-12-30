
module.exports = {
  name: "CHECKPATH",
  description: "Verify that a transaction contains a valid routing path starting from a given public key, where each hop is authorized by chained signatures bound to a static hash.",

  exampleScript: {
    op: "CHECKPATH",
    pubkey: "<publickey>",
    hash: "<hash>"
  },

  // In practice, routing data is extracted from tx.msg.path.
  // This witness is illustrative and fill-out-able for documentation/testing.
  exampleWitness: {},

  schema: {
    script: {
      pubkey: "string",
      hash: "string"
    },
    witness: {}
  },

  execute: function (app, script, witness, vars, tx, blk) {
    try {

      const start_pubkey = script.pubkey;
      const static_hash  = script.hash;

      if (!start_pubkey || !static_hash) {
        return false;
      }

      // Routing path is expected to live in tx.msg.path.
      // Fallback to witness.path only for non-tx evaluation / testing.
      const path = tx?.msg?.path || witness?.path;

      if (!Array.isArray(path) || path.length === 0) {
        return false;
      }

      let current_pubkey = start_pubkey;
      let valid_hops = 0;

      for (let i = 0; i < path.length; i++) {

        const hop = path[i];

        if (!hop?.to || !hop?.value || !hop?.sig) {
          return false;
        }

        // Signature preimage:
        // H( static_hash || to || value )
        const message = app.crypto.hash(
          static_hash + hop.to + hop.value
        );

        const is_valid = app.crypto.verifyMessage(
          message,
          hop.sig,
          current_pubkey
        );

        if (!is_valid) {
          return false;
        }

        // Advance chaining key
        current_pubkey = hop.to;
        valid_hops++;
      }

      // Require at least one valid hop
      return valid_hops > 0;

    } catch (err) {
      console.error("CHECKPATH error: ", err);
      return false;
    }
  }
};


