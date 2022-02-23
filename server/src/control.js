"use strict";

class Control_msg {
  constructor(id, command, payload) {
    this.id = id;
    this.command = command;
    this.payload = payload;
  }
}

module.exports = { Control_msg };