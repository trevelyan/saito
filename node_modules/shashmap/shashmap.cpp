/*
 *
 * This is the main class for the Saito Hashmap interface with Node
 * 
 * The Google Dense Map is contained in the file hashmap.cpp while
 * this file handles the interface with NodeJS and the processing 
 * of the JSON block file.
 *
 */

#include "include/rapidjson/reader.h"
#include <google/dense_hash_map>
#include <node.h>
#include <iostream>
#include <sstream>
#include <fstream>
#include <stdio.h>
#include <string.h>



using namespace rapidjson;
using namespace std;



///////////////////////////
// function declarations //
///////////////////////////
std::string open_file(std::string filename);
std::string return_slipname(std::string bid, std::string tid, std::string sid, std::string address, std::string amount, std::string bhash);
int insert_new_slip(std::string slipname, int spent_value_of_zero);
int validate_existing_slip(std::string slipname, int value);
int validate_slip_spent(std::string slipname); // is spent (not is spendable in this block) -- for monetary check
int update_existing_slip(std::string slipname, int value);
int check_slip_exists(std::string slipname);
int delete_slip(std::string slipname);


///////////////
// variables //
///////////////
google::dense_hash_map<std::string, int> slips;






// If you can require C++11, you could use std::to_string here
template <typename T> std::string stringify(T x) {
  std::stringstream ss;
  ss << x;
  return ss.str();
}


struct MyHandler {
    const char* type;
    std::string data;

    MyHandler() : type(), data() {}

    bool Null() { type = "Null"; data.clear(); return true; }
    bool Bool(bool b) { type = "Bool:"; data = b? "true": "false"; return true; }
    bool Int(int i) { type = "Int:"; data = stringify(i); return true; }
    bool Uint(unsigned u) { type = "Uint:"; data = stringify(u); return true; }
    bool Int64(int64_t i) { type = "Int64:"; data = stringify(i); return true; }
    bool Uint64(uint64_t u) { type = "Uint64:"; data = stringify(u); return true; }
    bool Double(double d) { type = "Double:"; data = stringify(d); return true; }
    bool RawNumber(const char* str, SizeType length, bool) { type = "Number:"; data = std::string(str, length); return true; }
    bool String(const char* str, SizeType length, bool) { type = "String:"; data = std::string(str, length); return true; }
    bool StartObject() { type = "StartObject"; data.clear(); return true; }
    bool Key(const char* str, SizeType length, bool) { type = "Key:"; data = std::string(str, length); return true; }
    bool EndObject(SizeType memberCount) { type = "EndObject:"; data = stringify(memberCount); return true; }
    bool StartArray() { type = "StartArray"; data.clear(); return true; }
    bool EndArray(SizeType elementCount) { type = "EndArray:"; data = stringify(elementCount); return true; }
private:
    MyHandler(const MyHandler& noCopyConstruction);
    MyHandler& operator=(const MyHandler& noAssignment);
};





using v8::Exception;
using v8::Function;
using v8::FunctionCallbackInfo;
using v8::Isolate;
using v8::Local;
using v8::Number;
using v8::Null;
using v8::Object;
using v8::String;
using v8::Value;






////////////////////////////////////
// save slips and validate inputs //
////////////////////////////////////
void processBlock(const FunctionCallbackInfo<Value>& args) {

  Isolate* isolate = args.GetIsolate();

  int return_value = 1;
  int valid_json   = 1;

  if (args.Length() != 3) {
    isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Wrong number of arguments")));
    return;
  }

  if (!args[0]->IsString()) {
    isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Expected name of block file")));
    return;
  }


  if (!args[1]->IsString()) {
    isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Expected block hash")));
    return;
  }


  ////////////////
  // grab block //
  ////////////////
  v8::String::Utf8Value param1(args[0]->ToString());
  std::string filename = std::string(*param1);
  std::string blkjson = open_file(filename);
  if (blkjson == "") {
    valid_json = 0;
    std::cout << "\n\nBlockJSON empty in C++ module..." << std::endl;
  }


  ////////////////
  // grab bhash //
  ////////////////
  v8::String::Utf8Value param2(args[1]->ToString());
  std::string block_hash = std::string(*param2);
  if (block_hash == "") {
    valid_json = 0;
    std::cout << "\n\nBlock Hash empty in C++ module..." << std::endl;
  }


//std::cout << "FOUND BLOCK HASH: " << block_hash << std::endl;

  ////////////////
  // parse json //
  ////////////////
  std::string block_bid  = "";
  int transactions = 0;
  int from_tx      = 0;
  int to_tx        = 0;
  int clear_slip   = 0;
  int block_bid_next     = 0;

  MyHandler handler;
  Reader reader;
  StringStream ss(blkjson.c_str());
  reader.IterativeParseInit();

  while (!reader.IterativeParseComplete() && valid_json == 1) {
    reader.IterativeParseNext<kParseDefaultFlags>(ss, handler);


    if (block_bid_next == 1) {
      block_bid_next = 0;
      block_bid = handler.data;
    }
    if (strcmp(handler.data.c_str(), "id") == 0) { block_bid_next = 1; }


    //
    // NOTE -- semi-colon (:) is inconsistent here
    //
    if (strcmp(handler.type, "EndArray:") == 0) { transactions = 0; }
    if (transactions == 1 && strcmp(handler.data.c_str(), "StartArray") != 0) {

      std::string tx = handler.data;

      if (tx != "") {

        std::string block_tid = "";
        std::string address     = "";
        std::string amount      = "";
        std::string bid         = "";
        std::string tid         = "";
        std::string sid         = "";
        std::string gt          = "";
        std::string ft          = "";
        std::string bhash       = "";
        std::string lc          = "";
        std::string rn          = "";

        int block_tid_next    = 0;
        int address_next        = 0;
        int amount_next         = 0;
        int bid_next            = 0;
        int tid_next            = 0;
        int sid_next            = 0;
        int gt_next             = 0;
        int ft_next             = 0;
        int bhash_next          = 0;
        int lc_next             = 0;
        int rn_next             = 0;

        clear_slip = 0;

        MyHandler handler2;
        Reader reader2;
        StringStream ss2(tx.c_str());
        reader2.IterativeParseInit();
        while (!reader2.IterativeParseComplete()) {

          if (block_tid_next == 1) {
            block_tid_next = 0;
            block_tid = handler2.data;
          }
          if (strcmp(handler2.data.c_str(), "id") == 0) { block_tid_next = 1; }

          if (clear_slip == 1) {
            address = "";
            amount  = "";
            bid     = "";
            tid     = "";
            sid     = "";
            gt      = "";
            ft      = "";
            bhash   = "";
            lc      = "";
            rn      = "";

            address_next    = 0;
            amount_next     = 0;
            bid_next        = 0;
            tid_next        = 0;
            sid_next        = 0;
            gt_next         = 0;
            ft_next         = 0;
            bhash_next      = 0;
            lc_next         = 0;
            rn_next         = 0;

            clear_slip = 0;
          }

          reader2.IterativeParseNext<kParseDefaultFlags>(ss2, handler2);

          if (strcmp(handler2.data.c_str(), "from") == 0) { from_tx = 1; to_tx = 0; }
          if (strcmp(handler2.data.c_str(), "to") == 0) { from_tx = 0; to_tx = 1; }

          if (from_tx == 1) {

            if (address_next == 1) {
              address = handler2.data;
              address_next = 0;
            }
            if (amount_next == 1) {
              amount = handler2.data;
              amount_next = 0;
            }
            if (bid_next == 1) {
              bid = handler2.data;
              bid_next = 0;
            }
            if (tid_next == 1) {
              tid = handler2.data;
              tid_next = 0;
            }
            if (sid_next == 1) {
              sid = handler2.data;
              sid_next = 0;
            }
            if (gt_next == 1) {
              gt = handler2.data;
              gt_next = 0;
            }
            if (ft_next == 1) {
              ft = handler2.data;
              ft_next = 0;
            }
            if (bhash_next == 1) {
              bhash = handler2.data;
              bhash_next = 0;
            }
            if (lc_next == 1) {
              lc = handler2.data;
              lc_next = 0;
            }
            if (rn_next == 1) {
              rn = handler2.data;
              rn_next = 0;

              // no need to validate slips with 0 in amount
              if (strcmp(amount.c_str(), "0") != 0) {

                std::string sn = return_slipname(bid, tid, sid, address, amount, bhash);
		//std::cout << "validating: " << sn << std::endl;
                if (validate_existing_slip(sn, atoi(block_bid.c_str())) == 0) {
		  return_value = 0;
		  //std::cout << sn << " failed to validate" << std::endl;
	        } else {
		  //std::cout << sn << " successfully validated" << std::endl;
		}

              }

              clear_slip = 1;

            }

            if (strcmp(handler2.data.c_str(), "add") == 0)   { address_next = 1; }
            if (strcmp(handler2.data.c_str(), "amt") == 0)   { amount_next = 1; }
            if (strcmp(handler2.data.c_str(), "bid") == 0)   { bid_next = 1; }
            if (strcmp(handler2.data.c_str(), "tid") == 0)   { tid_next = 1; }
            if (strcmp(handler2.data.c_str(), "sid") == 0)   { sid_next = 1; }
            if (strcmp(handler2.data.c_str(), "gt") == 0)    { gt_next = 1; }
            if (strcmp(handler2.data.c_str(), "ft") == 0)    { ft_next = 1; }
            if (strcmp(handler2.data.c_str(), "bhash") == 0) { bhash_next = 1; }
            if (strcmp(handler2.data.c_str(), "lc") == 0)    { lc_next = 1; }
            if (strcmp(handler2.data.c_str(), "rn") == 0)    { rn_next = 1; }

          }

          if (to_tx == 1) {

            if (address_next == 1) {
              address = handler2.data;
              address_next = 0;
            }
            if (amount_next == 1) {
              amount = handler2.data;
              amount_next = 0;
            }
            if (bid_next == 1) {
              bid = handler2.data;
              bid_next = 0;
            }
            if (tid_next == 1) {
              tid = handler2.data;
              tid_next = 0;
            }
            if (sid_next == 1) {
              sid = handler2.data;
              sid_next = 0;
            }
            if (gt_next == 1) {
              gt = handler2.data;
              gt_next = 0;
            }
            if (ft_next == 1) {
              ft = handler2.data;
              ft_next = 0;
            }
            if (bhash_next == 1) {
              bhash = handler2.data;
              bhash_next = 0;
            }
            if (lc_next == 1) {
              lc = handler2.data;
              lc_next = 0;
            }
            if (rn_next == 1) {
              rn = handler2.data;
              rn_next = 0;


              // random number is the last item in the FROM field, so validate
              std::string sn = return_slipname(block_bid, block_tid, sid, address, amount, block_hash);
	      //std::cout << "inserting: " << sn << std::endl;
              if (insert_new_slip(sn, 0) == 0) {
                std::cout << sn << " failed to insert" << std::endl;
              } else {
                //std::cout << sn << " successfully inserted" << std::endl;
              }

              clear_slip = 1;

            }

            if (strcmp(handler2.data.c_str(), "add") == 0)   { address_next = 1; }
            if (strcmp(handler2.data.c_str(), "amt") == 0)   { amount_next = 1; }
            if (strcmp(handler2.data.c_str(), "bid") == 0)   { bid_next = 1; }
            if (strcmp(handler2.data.c_str(), "tid") == 0)   { tid_next = 1; }
            if (strcmp(handler2.data.c_str(), "sid") == 0)   { sid_next = 1; }
            if (strcmp(handler2.data.c_str(), "gt") == 0)    { gt_next = 1; }
            if (strcmp(handler2.data.c_str(), "ft") == 0)    { ft_next = 1; }
            if (strcmp(handler2.data.c_str(), "bhash") == 0) { bhash_next = 1; }
            if (strcmp(handler2.data.c_str(), "lc") == 0)    { lc_next = 1; }
            if (strcmp(handler2.data.c_str(), "rn") == 0)    { rn_next = 1; }

          }
        }
      }
    }
    if (strcmp(handler.data.c_str(), "transactions") == 0) { transactions = 1; }
  }




  //
  // did we successfully validate?
  //
  Local<Function> cb = Local<Function>::Cast(args[2]);
  const unsigned argc = 1;
  Local<Value> argv[argc] = { 
    Number::New(isolate, return_value)
  };
  cb->Call(Null(isolate), argc, argv);

}











//////////////////
// spend inputs //
//////////////////
void spendInputs(const FunctionCallbackInfo<Value>& args) {

  Isolate* isolate = args.GetIsolate();

  int return_value = 1;
  int valid_json   = 1;

  if (args.Length() != 3) {
    isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Wrong number of arguments")));
    return;
  }

  if (!args[0]->IsString()) {
    isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Expected name of block file")));
    return;
  }


  if (!args[1]->IsString()) {
    isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Expected block hash")));
    return;
  }


  ////////////////
  // grab block //
  ////////////////
  v8::String::Utf8Value param1(args[0]->ToString());
  std::string filename = std::string(*param1);
  std::string blkjson = open_file(filename);
  if (blkjson == "") {
    valid_json = 0;
    std::cout << "\n\nBlockJSON empty in C++ module..." << std::endl;
  }


  ////////////////
  // grab bhash //
  ////////////////
  v8::String::Utf8Value param2(args[1]->ToString());
  std::string block_hash = std::string(*param2);
  if (block_hash == "") {
    valid_json = 0;
    std::cout << "\n\nBlock Hash empty in C++ module..." << std::endl;
  }


  ////////////////
  // parse json //
  ////////////////
  std::string block_bid  = "";
  int transactions = 0;
  int from_tx      = 0;
  int to_tx        = 0;
  int clear_slip   = 0;
  int block_bid_next     = 0;

  MyHandler handler;
  Reader reader;
  StringStream ss(blkjson.c_str());
  reader.IterativeParseInit();

  while (!reader.IterativeParseComplete() && valid_json == 1) {
    reader.IterativeParseNext<kParseDefaultFlags>(ss, handler);


    if (block_bid_next == 1) {
      block_bid_next = 0;
      block_bid = handler.data;
    }
    if (strcmp(handler.data.c_str(), "id") == 0) { block_bid_next = 1; }


    //
    // NOTE -- semi-colon (:) is inconsistent here
    //
    if (strcmp(handler.type, "EndArray:") == 0) { transactions = 0; }
    if (transactions == 1 && strcmp(handler.data.c_str(), "StartArray") != 0) {

      std::string tx = handler.data;

      if (tx != "") {

        std::string block_tid = "";
        std::string address     = "";
        std::string amount      = "";
        std::string bid         = "";
        std::string tid         = "";
        std::string sid         = "";
        std::string gt          = "";
        std::string ft          = "";
        std::string bhash       = "";
        std::string lc          = "";
        std::string rn          = "";

        int block_tid_next    = 0;
        int address_next        = 0;
        int amount_next         = 0;
        int bid_next            = 0;
        int tid_next            = 0;
        int sid_next            = 0;
        int gt_next             = 0;
        int ft_next             = 0;
        int bhash_next          = 0;
        int lc_next             = 0;
        int rn_next             = 0;

        clear_slip = 0;

        MyHandler handler2;
        Reader reader2;
        StringStream ss2(tx.c_str());
        reader2.IterativeParseInit();
        while (!reader2.IterativeParseComplete()) {

          if (block_tid_next == 1) {
            block_tid_next = 0;
            block_tid = handler2.data;
          }
          if (strcmp(handler2.data.c_str(), "id") == 0) { block_tid_next = 1; }

          if (clear_slip == 1) {
            address = "";
            amount  = "";
            bid     = "";
            tid     = "";
            sid     = "";
            gt      = "";
            ft      = "";
            bhash   = "";
            lc      = "";
            rn      = "";

            address_next    = 0;
            amount_next     = 0;
            bid_next        = 0;
            tid_next        = 0;
            sid_next        = 0;
            gt_next         = 0;
            ft_next         = 0;
            bhash_next      = 0;
            lc_next         = 0;
            rn_next         = 0;

            clear_slip = 0;
          }

          reader2.IterativeParseNext<kParseDefaultFlags>(ss2, handler2);

          if (strcmp(handler2.data.c_str(), "from") == 0) { from_tx = 1; to_tx = 0; }
          if (strcmp(handler2.data.c_str(), "to") == 0) { from_tx = 0; to_tx = 1; }

          if (from_tx == 1) {

            if (address_next == 1) {
              address = handler2.data;
              address_next = 0;
            }
            if (amount_next == 1) {
              amount = handler2.data;
              amount_next = 0;
            }
            if (bid_next == 1) {
              bid = handler2.data;
              bid_next = 0;
            }
            if (tid_next == 1) {
              tid = handler2.data;
              tid_next = 0;
            }
            if (sid_next == 1) {
              sid = handler2.data;
              sid_next = 0;
            }
            if (gt_next == 1) {
              gt = handler2.data;
              gt_next = 0;
            }
            if (ft_next == 1) {
              ft = handler2.data;
              ft_next = 0;
            }
            if (bhash_next == 1) {
              bhash = handler2.data;
              bhash_next = 0;
            }
            if (lc_next == 1) {
              lc = handler2.data;
              lc_next = 0;
            }
            if (rn_next == 1) {
              rn = handler2.data;
              rn_next = 0;

              // no need to spend slips with 0 in amount
              if (strcmp(amount.c_str(), "0") != 0) {

                std::string sn = return_slipname(bid, tid, sid, address, amount, bhash);
		//std::cout << "spending: " << sn << std::endl;
                if (update_existing_slip(sn, atoi(block_bid.c_str())) == 0) {
		  return_value = 0;
		  std::cout << sn << " failed to spend" << std::endl;
	        } else {
		  //std::cout << sn << " successfully spent" << std::endl;
		}

              }

              clear_slip = 1;

            }

            if (strcmp(handler2.data.c_str(), "add") == 0)   { address_next = 1; }
            if (strcmp(handler2.data.c_str(), "amt") == 0)   { amount_next = 1; }
            if (strcmp(handler2.data.c_str(), "bid") == 0)   { bid_next = 1; }
            if (strcmp(handler2.data.c_str(), "tid") == 0)   { tid_next = 1; }
            if (strcmp(handler2.data.c_str(), "sid") == 0)   { sid_next = 1; }
            if (strcmp(handler2.data.c_str(), "gt") == 0)    { gt_next = 1; }
            if (strcmp(handler2.data.c_str(), "ft") == 0)    { ft_next = 1; }
            if (strcmp(handler2.data.c_str(), "bhash") == 0) { bhash_next = 1; }
            if (strcmp(handler2.data.c_str(), "lc") == 0)    { lc_next = 1; }
            if (strcmp(handler2.data.c_str(), "rn") == 0)    { rn_next = 1; }

          }
        }
      }
    }
    if (strcmp(handler.data.c_str(), "transactions") == 0) { transactions = 1; }
  }



  //
  // did we successfully update?
  //
  Local<Function> cb = Local<Function>::Cast(args[2]);
  const unsigned argc = 1;
  Local<Value> argv[argc] = { 
    Number::New(isolate, return_value)
  };
  cb->Call(Null(isolate), argc, argv);

}










void jsInsertSlip(const FunctionCallbackInfo<Value>& args) {

  //Isolate* isolate = args.GetIsolate();

  ///////////////
  // variables //
  ///////////////
  v8::String::Utf8Value param1(args[0]->ToString());
  std::string slipname = std::string(*param1);
  int value = args[1]->NumberValue();

  int rv = insert_new_slip(slipname, value);

  args.GetReturnValue().Set(rv);

}
void jsValidateSlip(const FunctionCallbackInfo<Value>& args) {

  //Isolate* isolate = args.GetIsolate();

  ///////////////
  // variables //
  ///////////////
  v8::String::Utf8Value param1(args[0]->ToString());
  std::string slipname = std::string(*param1);
  int value = args[1]->NumberValue();

  int rv = validate_existing_slip(slipname, value);
  
  args.GetReturnValue().Set(rv);
}
void jsValidateSlipSpent(const FunctionCallbackInfo<Value>& args) {

  //Isolate* isolate = args.GetIsolate();

  ///////////////
  // variables //
  ///////////////
  v8::String::Utf8Value param1(args[0]->ToString());
  std::string slipname = std::string(*param1);

  int rv = validate_slip_spent(slipname);
  
  args.GetReturnValue().Set(rv);
}
void jsExistsSlip(const FunctionCallbackInfo<Value>& args) {

  //Isolate* isolate = args.GetIsolate();

  ///////////////
  // variables //
  ///////////////
  v8::String::Utf8Value param1(args[0]->ToString());
  std::string slipname = std::string(*param1);

  int rv = check_slip_exists(slipname);

  args.GetReturnValue().Set(rv);

}
void jsDeleteSlip(const FunctionCallbackInfo<Value>& args) {

  //Isolate* isolate = args.GetIsolate();

  ///////////////
  // variables //
  ///////////////
  v8::String::Utf8Value param1(args[0]->ToString());
  std::string slipname = std::string(*param1);

  int rv = delete_slip(slipname);

  args.GetReturnValue().Set(rv);

}









// this function is run when we include the module into
// our application. 
void init(Local<Object> exports) {


  // on initialization, we resize our Hashmap to a reasonable number
//  slips.resize(100000000);


  ////////////////////////
  // initialize hashmap //
  ////////////////////////
  std::string y = "_1";
  std::string z = "_2";
  slips.set_empty_key(y);
  slips.set_deleted_key(z);

  NODE_SET_METHOD(exports, "validate", processBlock);
  NODE_SET_METHOD(exports, "spend",   spendInputs);
  NODE_SET_METHOD(exports, "insert_slip",  jsInsertSlip);
  NODE_SET_METHOD(exports, "validate_slip",  jsValidateSlip);
  NODE_SET_METHOD(exports, "validate_slip_spent",  jsValidateSlipSpent);
  NODE_SET_METHOD(exports, "exists_slip",  jsExistsSlip);
  NODE_SET_METHOD(exports, "delete_slip",  jsDeleteSlip);

}

NODE_MODULE(shashmap, init)




























/////////////////////
// Open Input File //
/////////////////////
std::string open_file(std::string filename) {

        std::string fulltext = "";

        //try {

                std::string str;
                std::ifstream INPUT(filename.c_str());
                int loop = 0;
                while (std::getline(INPUT, str)) {
                        if (loop != 0) {
                                fulltext += "\n";
                        } fulltext += str; loop++;
                }
                INPUT.close();
        //}

        //catch (...) {
	//	return "";
        //}
        return fulltext;
}
/////////////////////
// return slipname //
/////////////////////
std::string return_slipname(std::string bid, std::string tid, std::string sid, std::string address, std::string amount, std::string bhash) {
  return bid + tid + sid + address + bhash + amount;
}
//////////////////////////
// update existing slip //
//////////////////////////
int update_existing_slip(std::string slipname, int value) {
  return insert_new_slip(slipname, value);
}
/////////////////////
// insert new slip //
/////////////////////
int insert_new_slip(std::string slipname, int spent_value_of_zero) {
  slips[slipname] = spent_value_of_zero;
  return 1;
}
////////////////////////////
// validate existing slip //
////////////////////////////
int validate_existing_slip(std::string slipname, int current_block_id) {
  if (slips[slipname] == 0) { return 0; }
  if (slips[slipname] == -1) { return 1; }
  if (slips[slipname] >= current_block_id) { return 1; }
  return 0;
}
///////////////////
// is slip spent //
///////////////////
int validate_slip_spent(std::string slipname) {
  if (slips[slipname] == -1) { return 1; }
  return 0;
}
/////////////////
// delete slip //
/////////////////
int delete_slip(std::string slipname) {
  slips.erase(slipname);
  return 1;
}
///////////////////////
// check slip exists //
///////////////////////
int check_slip_exists(std::string slipname) {
  if (slips.find(slipname) != slips.end()) {
    return 1;
  }
  return 0;
}





