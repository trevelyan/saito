
module.exports = {
  name: "CHECKPATHTIME",
  description: "Compare a timestamp embedded in a routing path hop against the current time with a fixed offset.",

  exampleScript: {
    op: "CHECKPATHTIME",
    hop: 1,
    operator: "<=",
    delta: 300000
  },

  // Witness is illustrative only.
  // In practice, the routing path is read from tx.msg.path.
  exampleWitness: {
    path: [
      {
        to: "<receiver_public_key>",
        value: "<timestamp>",
        sig: "<signature>"
      }
    ]
  },

  schema: {
    script: {
      hop: "number",
      operator: "string",
      delta: "number"
    },
    witness: {
      path: "array"
    }
  },

  execute: function (app, script, witness, vars, tx, blk) {
    try {

      const hopIndex = script.hop;
      const operator = script.operator;
      const delta    = script.delta;

      if (
        hopIndex === undefined ||
        !operator ||
        delta === undefined
      ) {
        return false;
      }

      const path = tx?.msg?.path || witness?.path;

      if (!Array.isArray(path) || path.length <= hopIndex) {
        return false;
      }

      const hop = path[hopIndex];

      if (!hop?.value) {
        return false;
      }

      // Treat value as timestamp (ms)
      const hopTime = parseInt(hop.value, 10);
      if (isNaN(hopTime)) {
        return false;
      }

      // Current time (ms)
      const now = Date.now();
      const compareTime = hopTime + delta;

      switch (operator) {
        case "<":
          return now < compareTime;
        case "<=":
          return now <= compareTime;
        case ">":
          return now > compareTime;
        case ">=":
          return now >= compareTime;
        case "==":
          return now === compareTime;
        default:
          return false;
      }

    } catch (err) {
      console.error("CHECKPATHTIME error: ", err);
      return false;
    }
  }
};


