"use strict";

/**
 * A Control_msg encapsulates an IPC message passed between the emulator and a peer process. The 
 * emulator controller instructs a peer to do something by sending them a Control_msg, and the peer 
 * returns their response in a Control_msg.
 */ 

class Control_msg {
  constructor(id, command, payload) {
    this.id = id;
    this.command = command;
    this.payload = payload;
  }
}

module.exports = { Control_msg };