# Host tests for the hardware-independent firmware core.
CXX ?= g++
CXXFLAGS ?= -std=c++17 -Wall -Wextra -Werror -Wno-format-truncation -O1 -fsanitize=address,undefined

run: test_core
	./test_core

test_core: test_core.cpp ../../lib/marq_core/marq_core.h
	$(CXX) $(CXXFLAGS) -o $@ test_core.cpp

clean:
	rm -f test_core
.PHONY: run clean
