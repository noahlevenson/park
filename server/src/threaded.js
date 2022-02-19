"use strict";

const cfg = require("../park.json");
const p = cfg.passerby_path;
const { Transport, Rinfo } = require(`${p}/src/transport/transport.js`);

class Threaded extends Transport {
  constructor({my_addr, my_port = 31337, worker_port} = {}) {
    super();
    this.my_addr = my_addr;
    this.my_port = my_port;
    this.worker_port = worker_port;  
    this.worker_port.on("message", (msg) => {
      this.recv.emit("message", msg.msg, msg.rinfo);
    });
  }

  /**
   * rinfo must be an Rinfo object with an address field set to the pubstring of the recipient
   */ 
  async send(msg, rinfo, ttl) {
    const my_rinfo = new Rinfo({address: this.my_addr, port: this.my_port, family: "threaded"});
    this.worker_port.postMessage({recip: rinfo.address, msg: msg, rinfo: my_rinfo});
  }

  on_network() {
    // Do nothing
  }
}

module.exports = { Threaded };