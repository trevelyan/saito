
#include <string> 
#include <iostream>
#include <google/dense_hash_map>

int main(int argc, char**) {

  google::dense_hash_map<std::string, int> slips;
  std::string y = "empty1";
  std::string z = "empty2";
  slips.set_empty_key(y);
  slips.set_deleted_key(z);
  //slips.resize(10000000);

  std::string x;

  for (int i = 0; i < 1000000; i++) {
    x = std::to_string(1) + std::to_string(i) + "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF500.00000000";
    slips[x] = i;
  }
  for (int i = 0; i < 1000000; i++) {
    x = std::to_string(1) + std::to_string(i) + "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF500.00000000";
    slips[x] = i+2;
  }
  for (int i = 0; i < 1000000; i++) {
    x = std::to_string(1) + std::to_string(i) + "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF500.00000000";
    slips.erase(x);
//    if (slips.find(x) != slips.end()) {
   //   std::cout << ".";
//    }
  }

}




