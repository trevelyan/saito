const saito = require('./../../lib/saito/saito');
const SaitoHeader = require('./../../lib/saito/ui/saito-header/saito-header');
const SaitoNFT = require('./../../lib/saito/ui/saito-nft/saito-nft');
const ModTemplate = require('./../../lib/templates/modtemplate');
const ScriptingMain = require('./lib/ui/main');


/////////////
// OPCODES //
/////////////
const OpcodeCheckSig      = require('./lib/opcodes/checksig');
const OpcodeCheckTime     = require('./lib/opcodes/checktime');
const OpcodeCheckHash     = require('./lib/opcodes/checkhash');
const OpcodeCheckSender   = require('./lib/opcodes/checksender');
const OpcodeCheckField    = require('./lib/opcodes/checkfield');
const OpcodeCheckMultiSig = require('./lib/opcodes/checkmultisig');
const OpcodeCheckOwn      = require('./lib/opcodes/checkown');
const OpcodeCheckOwnNft   = require('./lib/opcodes/checkownnft');
const OpcodeCheckPath     = require('./lib/opcodes/checkpath');
const OpcodeCheckPathTime = require('./lib/opcodes/checkpathtime');

class Scripting extends ModTemplate {

	constructor(app) {

		super(app);

		this.appname = 'Scripting';
		this.name = 'Scripting';
		this.slug = 'scripting';
		this.description = 'Support Tools for writing and testing Saito Script';
		this.categories = 'Utility Cryptography Programming';

    		this.MAX_DEPTH = 8;
    		this.MAX_NODES = 16;

		this.main = new ScriptingMain(this.app, this, ".saito-container");

		this.opcodes = {};

	}

	initialize(app) {

		//
		// initialize our opcodes
		//
		[
		  OpcodeCheckSig , OpcodeCheckTime , OpcodeCheckHash , 
      		  OpcodeCheckSender , OpcodeCheckField , OpcodeCheckMultiSig, 
      		  OpcodeCheckOwn, OpcodeCheckOwnNft, OpcodeCheckPath, 
		  OpcodeCheckPathTime 
    		].forEach((op) => { 
  			if (op?.name && typeof op.execute === "function") {
  		  		this.opcodes[op.name.toLowerCase()] = op;
  			}
		});


	}

	render() {

		this.header = new SaitoHeader(this.app, this);

		this.header.render();
		this.main.render();

	}




        ///////////////////////////////// 
        // inter-module communications //
        /////////////////////////////////
        respondTo(type = '', obj) {
          let this_mod = this; 

          if (type === 'saito-create-nft') {
            return {
              title : "Scripting NFT" ,
              class : ["scripting-nft-mod"] ,
	      text : "Access Script" ,
              createObject : async (script) => {
                let obj = {};
                obj.module = "Scripting";
                obj.access_hash = this_mod.app.crypto.hash(this_mod.canonicalize(script));
                return obj;
              } ,
            };  
          }
                
          return super.respondTo(type, obj);
                
        }
                




  	//
  	// Canonicalize
  	//
  	// this converts the input into a standarized object so that when 
  	// it is hashed the output will be consistent and the same hash will
  	// be generated on every system.
  	//
canonicalize(x) {

    // null
    if (x === null) { return "null"; }

    // primitives
    if (typeof x === "number") { return JSON.stringify(x); }
    if (typeof x === "boolean") { return JSON.stringify(x); }
    if (typeof x === "string") { return JSON.stringify(x); }

    // array
    if (Array.isArray(x)) {
        return "[" + x.map(v => this.canonicalize(v)).join(",") + "]";
    }

    // object
    if (typeof x === "object") {
        const keys = Object.keys(x).sort();
        const parts = keys.map(k =>
            JSON.stringify(k) + ":" + this.canonicalize(x[k])
        );
        return "{" + parts.join(",") + "}";
    }

    return null; // unsupported type
}



  	//
  	//
  	//
	hash(script) {

	    if (script === null || script === undefined) {
	        return "";
	    }

	    // If script is a raw JSON string, parse it first
	    if (typeof script === "string") {
	        try {
	            script = JSON.parse(script);
	        } catch (err) {
	            console.error("hash(): script is a string but not valid JSON:", err);
	            return "";
	        }
	    }

	    // Now canonicalize always receives an object or primitive
	    const canonical = this.canonicalize(script);

	    if (canonical == null) { return ""; }

	    return this.app.crypto.hash(canonical);
	}


  	//
  	// evaluate
  	//
  	// this takes the HASH of a script, a submitted script, and the
  	// witness variables to insert in the script and evaluates it to 
  	// return TRUE or FALSE based on whether the script validates
  	// successfully or not.
  	//
  	async evaluate(hash="", script="", witness = "", vars = {}, tx = null, blk = null) {


console.log("into evaluate... 1");
console.log("tx _eval:", tx);

		let counter = {};
		counter.node = 0;
		counter.depth = 0;

    		//
    		// scripts are communicated over the network as JSON strings, so we 
    		// convert the script into an object that can be canonicalized to 
    		// confirm that the hash is correct before evaluating its contents.
    		// make sure script is JSON object
    		//
    		if (typeof script === "string") {
      			try {
        			script = JSON.parse(script);
      			} catch (err) {
        			console.warn("Saito Scripting: invalid JSON script string");
        			return false;
      			}
    		}

    		//
    		// witness vars are also communicated over the network as JSON strings, 
		// so we conver the script into an object if it is not already one.
    		//
    		if (typeof witness === "string") {
      			try {
        			witness = JSON.parse(witness);
      			} catch (err) {
console.log("invalid witness error");
        			console.warn("Saito Scripting: invalid JSON script string");
        			return false;
      			}
    		}

    		//
    		// first we check the correctness of the HASH that is provided, as
    		// there is no point in trying to evaluate the script if it is not 
    		// the correct one.
    		//
    		let vhash = this.hash(script);
    		if (vhash !== hash) {
console.log("back hash error");
    		  	console.warn("Saito Scripting: script reduces to incorrect hash", vhash, "≠", hash);
    		  	return false;
    		}

console.log("swap witness dat into script and evaluate... 2");
console.log("script: " + JSON.stringify(script));
console.log("witness: " + JSON.stringify(witness));

    		//
    		// swap witness data into script and evaluate the rules
    		//
    		return await this._eval(script, witness, vars, counter, tx, blk);

  	}



async _eval(script, witness, vars, counter, tx, blk) {

console.log("tx _eval:", tx);
  //
  // Safety checks
  //
  counter.node++;
  if (counter.depth > this.MAX_DEPTH) {
    console.warn(`Saito Scripting: exceeded max recursion depth (${this.MAX_DEPTH})`);
    return false;
  }
  if (counter.node > this.MAX_NODES) {
    console.warn(`Saito Scripting: exceeded max node count (${this.MAX_NODES})`);
    return false;
  }

  if (!script || typeof script !== "object") return false;
  if (!witness || typeof witness !== "object") return false;

  // normalize args: ALWAYS treat missing args as []
  const args = Array.isArray(script.args) ? script.args : [];

  const op = (script.op || "").toLowerCase();

  //
  // LOGICAL OPS
  //
  switch (op) {
    case "and": {
      counter.depth++;
      try {
        return args.every(arg => this._eval(arg, witness, vars, counter, tx, blk));
      } finally {
        counter.depth--;
      }
    }

    case "or": {
      counter.depth++;
      try {
        return args.some(arg => this._eval(arg, witness, vars, counter, tx, blk));
      } finally {
        counter.depth--;
      }
    }

    case "not": {
      counter.depth++;
      try {
        return !this._eval(args[0], witness, vars, counter, tx, blk);
      } finally {
        counter.depth--;
      }
    }
  }

  //
  // OPCODES
  //
  const opcode = this.opcodes[op];
  if (!opcode) {
    console.warn("Unknown opcode:", op);
    return false;
  }

  try {
    console.log("going to execute:");
    console.log("script: ", script);
    console.log("witness: ", witness);
    console.log("vars: ", vars);
    console.log("tx: ", tx);
    return await opcode.execute(this.app, script, witness, vars, tx, blk);
  } catch (err) {
    console.error(`Error executing opcode '${op}':`, err);
    return false;
  }
}







/********************************************************************
 * convertScriptDescriptionToScriptAndWitnessJSON(description)
 * ------------------------------------------------------------
 * Main entry point.
 ********************************************************************/
convertScriptDescriptionToScriptAndWitnessJSON(text) {
  try {
    const tokens = this._tokenize(text);
    const parsed = this._parseTokens(tokens);
    const validated = this._applyOpcodeSchemas(parsed.ast);

    //
    // NEW assembler returns {script, witness}
    //
    const { script, witness } = this._assembleScriptAndWitness(validated);

    return { script, witness };

  } catch (err) {
    console.error("Script conversion failed:", err);
    alert("Error: " + err.message);
    return { script: {}, witness: [] };
  }
}




/********************************************************************
 * 1. NORMALIZATION LAYER
 * ------------------------------------------------------------
 * Turns flexible syntax into canonical symbolic Saito form.
 ********************************************************************/
_normalizeDescription(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Empty script description.");
  }

  let t = text.trim();

  // normalize newlines and commas into whitespace, collapse multiple spaces
  t = t.replace(/[\r\n]+/g, " ");
  t = t.replace(/,/g, " ");
  t = t.replace(/\s+/g, " ");

  // allow "with" as optional fluff: "CHECKSIG with publickey=..." -> "CHECKSIG publickey=..."
  t = t.replace(/\bwith\b/gi, " ");

  // allow some natural synonyms
  t = t.replace(/\bunless\b/gi, "NOT");
  t = t.replace(/\beither\b/gi, "OR");
  t = t.replace(/\bboth\b/gi, "AND");
  t = t.replace(/\brequire(s)?\b/gi, " ");
  t = t.replace(/\bmust\b/gi, " ");
  t = t.replace(/\bneed(s)?\b/gi, " ");

  // tolerate colloquial words for not/and/or
  t = t.replace(/\band\b/gi, "AND");
  t = t.replace(/\bor\b/gi, "OR");
  t = t.replace(/\bnot\b/gi, "NOT");

  // Expand known opcode synonyms to their canonical names (op.name may be mixed case)
  for (const opName in this.opcodes) {
    try {
      const re = new RegExp("\\b" + opName.toLowerCase() + "\\b", "gi");
      t = t.replace(re, opName);
    } catch (e) {
      // ignore malformed regex for weird opcode names
    }
  }

  // Trim again and return
  return t.trim();
}


/********************************************************************
 * 2. TOKENIZER
 ********************************************************************/
_tokenize(text) {
  const tokens = [];
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (/\s/.test(ch)) { i++; continue; }
    if (ch === "(") { tokens.push({ type: "LPAREN" }); i++; continue; }
    if (ch === ")") { tokens.push({ type: "RPAREN" }); i++; continue; }
    if (ch === "=") { tokens.push({ type: "EQUAL" }); i++; continue; }

    // quoted string (supports escaped quotes \" inside)
    if (ch === '"') {
      let j = i + 1;
      let value = "";
      while (j < text.length) {
        if (text[j] === '"' && text[j-1] !== "\\") break;
        value += text[j];
        j++;
      }
      if (j >= text.length) throw new Error("Unterminated quoted string.");
      // unescape quotes
      value = value.replace(/\\"/g, '"');
      tokens.push({ type: "STRING", value });
      i = j + 1;
      continue;
    }

    // words: letters / numbers / underscores / hyphens / colons / dots
    if (/[A-Za-z0-9_\-:\.]/.test(ch)) {
      let j = i + 1;
      while (j < text.length && /[A-Za-z0-9_\-:\.]/.test(text[j])) j++;
      const word = text.slice(i, j);
      tokens.push({ type: "WORD", value: word });
      i = j;
      continue;
    }

    // unknown character
    throw new Error("Unexpected character: " + ch);
  }

  return tokens;
}



/********************************************************************
 * 3. RECURSIVE DESCENT PARSER
 ********************************************************************/
_parseTokens(tokens) {
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];

  const isLogicalWord = (w) => {
    if (!w) return false;
    const v = w.toLowerCase();
    return v === "and" || v === "or" || v === "not";
  };

  //
  // PRIMARY PARSER
  //
  const parsePrimary = () => {
    const tok = peek();
    if (!tok) throw new Error("Unexpected end of input");

    // unary NOT
    if (tok.type === "WORD" && tok.value.toLowerCase() === "not") {
      next();
      return { type: "logical", op: "not", args: [parseExpr(0)] };
    }

    //
    // Parenthesized prefix or parenthesized infix
    //
    if (tok.type === "LPAREN") {
      next(); // '('

      const first = peek();
      if (!first || first.type !== "WORD")
        throw new Error("Expected operator or opcode after '('");

      next();
      const op = first.value.toLowerCase();

      const children = [];
      while (peek() && peek().type !== "RPAREN") {
        const child = parsePrimary();
        children.push(child);
      }
      if (!peek()) throw new Error("Missing ')'");
      next(); // ')'

      if (isLogicalWord(op)) {
        // PREFIX LOGICAL, all children are expressions
        return { type: "logical", op, args: children };
      }

      // PREFIX OPCODE FORM: (CHECKSIG ...)
      return {
        type: "opcode_call",
        name: op,
        fields: {},
        positionalArgs: children   // << allowed only in parentheses
      };
    }

    //
    // OPCODE CALL or FIELD ASSIGNMENT
    //
    if (tok.type === "WORD") {
      const nameTok = next();
      const name = nameTok.value.toLowerCase();
      const fields = {};

      // Named fields, but never swallow expressions
      while (
        peek() &&
        peek().type === "WORD" &&
        !isLogicalWord(peek().value)
      ) {
        const k = next();

        if (peek() && peek().type === "EQUAL") {
          next(); // '='
          const val = next();
          if (!val || (val.type !== "WORD" && val.type !== "STRING"))
            throw new Error("Expected value after '='");
          fields[k.value] = val.value;
        } else {
          fields[k.value] = true;
        }
      }

      return { type: "opcode_call", name, fields };
    }

    throw new Error("Unexpected token: " + JSON.stringify(tok));
  };

  //
  // INFIX PARSER
  //
  const PRECEDENCE = { or: 1, and: 2 };

  const parseExpr = (minPrec = 0) => {
    let left = parsePrimary();

    while (true) {
      const t = peek();
      if (!t || t.type !== "WORD") break;
      const w = t.value.toLowerCase();
      if (w !== "and" && w !== "or") break;

      const prec = PRECEDENCE[w];
      if (prec < minPrec) break;

      next(); // consume operator
      const right = parseExpr(prec + 1);

      if (left.type === "logical" && left.op === w) {
        left.args.push(right);
      } else {
        left = { type: "logical", op: w, args: [left, right] };
      }
    }

    return left;
  };

  //
  // MULTI-TOP-LEVEL = implicit AND
  //
  const exprs = [];
  while (i < tokens.length) {
    exprs.push(parseExpr(0));
  }

  if (exprs.length === 1) return { ast: exprs[0] };
  return { ast: { type: "logical", op: "and", args: exprs } };
}




/********************************************************************
 * 4. APPLY OPCODE SCHEMAS (semantic validation)
 ********************************************************************/
_applyOpcodeSchemas(node) {

  const logicalOps = ["and", "or", "not"];

  //
  // LOGICAL NODE
  //
  if (node.type === "logical") {
    return {
      type: "logical",
      op: node.op,
      args: node.args.map((child) => this._applyOpcodeSchemas(child))
    };
  }

  //
  // OPCODE_CALL
  //
  if (node.type === "opcode_call") {
    const opName = node.name.toLowerCase();
    const opcode = this.opcodes[opName];
    if (!opcode) throw new Error(`Unknown opcode: ${opName}`);

    const schema = opcode.schema || { script: {}, witness: {} };
    const scriptFields = {};
    const witnessFields = {};

    // Named fields only
    for (const key in node.fields) {
      const val = node.fields[key];

      if (key in schema.script) scriptFields[key] = val;
      else if (key in schema.witness) witnessFields[key] = val;
      else throw new Error(`Unknown field '${key}' for opcode '${opName}'.`);
    }

    // Positional args ONLY if the opcode supports positional expressions
    if (node.positionalArgs && node.positionalArgs.length > 0) {
      if (!schema.allowExpressionArgs) {
        throw new Error(
          `Opcode '${opName}' does not accept nested expressions.`
        );
      }
      scriptFields.__args = node.positionalArgs.map((c) =>
        this._applyOpcodeSchemas(c)
      );
    }

    // defaults
    if (opcode.exampleScript) {
      for (const k in schema.script) {
        if (!(k in scriptFields)) {
          scriptFields[k] = opcode.exampleScript[k] || "";
        }
      }
    }
    if (opcode.exampleWitness) {
      for (const k in schema.witness) {
        if (!(k in witnessFields)) {
          witnessFields[k] = opcode.exampleWitness[k] || "";
        }
      }
    }

    // required
    for (const k in schema.script) {
      if (!(k in scriptFields)) {
        throw new Error(`Missing script field '${k}' for opcode '${opName}'.`);
      }
    }

    return {
      type: "opcode",
      name: opName,
      scriptFields,
      witnessFields
    };
  }

  //
  // Already processed opcode
  //
  if (node.type === "opcode") return node;

  throw new Error("Invalid AST node type: " + node.type);
}





/********************************************************************
 * 5. ASSEMBLE FINAL JSON
 ********************************************************************/
_assembleScriptAndWitness(ast) {

  //
  // Recursively turn validated AST into script JSON
  // and collect witness objects into an array
  //
  const witnessList = [];

  const buildScript = (node) => {

    //
    // LOGICAL NODE
    //
    if (node.type === "logical") {
      return {
        op: node.op,
        args: node.args.map(buildScript)
      };
    }

    //
    // OPCODE NODE
    //
    if (node.type === "opcode") {
      //
      // Extract witness if any and push into flat array
      //
      if (node.witnessFields && Object.keys(node.witnessFields).length > 0) {
        witnessList.push({ ...node.witnessFields });
      } else {
        witnessList.push({});
      }

      //
      // Script representation (without witnessFields)
      //
      return {
        op: node.name,
        ...node.scriptFields
      };
    }

    throw new Error("Unknown AST node in assembly: " + JSON.stringify(node));
  };

  const script = buildScript(ast);

  return {
    script,
    witness: witnessList
  };
}



/**
 * generateWitnessFromScript(access_script)
 * 
 * Takes a script JSON and returns a witness template with placeholder values.
 * Mirrors the structure of _assembleScriptAndWitness but in reverse.
 * 
 * @param {Object|String} access_script - The compiled script JSON
 * @returns {Object} - Witness template object
 */
generateWitnessFromScript(access_script) {
  try {
    // Parse if string
    let script = typeof access_script === 'string' 
      ? JSON.parse(access_script) 
      : access_script;
    
    const collectWitness = (node) => {
      if (!node || typeof node !== 'object') return {};
      
      let op = (node.op || '').toLowerCase();
      
      // Logical operators - merge witness from all args
      if (['and', 'or', 'not'].includes(op)) {
        let merged = {};
        if (Array.isArray(node.args)) {
          node.args.forEach(arg => {
            Object.assign(merged, collectWitness(arg));
          });
        }
        return merged;
      }
      
      // Regular opcode - return its example witness
      let opcode = this.opcodes[op];
      return opcode?.exampleWitness || {};
    };
    
    return collectWitness(script);
    
  } catch (err) {
    console.error('generateWitnessFromScript error:', err);
    return {};
  }
}



}

module.exports = Scripting;

