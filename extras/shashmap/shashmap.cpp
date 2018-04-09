/*
 *
 * This is the main class for the Saito Hashmap interface with Node
 * 
 * The Google Dense Map is contained in the file hashmap.cpp while
 * this file handles the interface with NodeJS and the processing 
 * of the JSON block file.
 *
 */

#include <google/dense_hash_map>
#include <node.h>
#include <iostream>
#include <sstream>
#include <fstream>
#include <stdio.h>
#include <string.h>



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





