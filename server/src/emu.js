"use strict";

const EventEmitter = require("events");
const { Worker, MessageChannel } = require("worker_threads");
const cfg = require("../park.json");
const p = cfg.passerby_path;
const { Passerby } = require(`${p}src/protocol/protocol.js`);
const { Local } = require(`${p}src/transport/local/local.js`);
const { Identity } = require(`${p}src/protocol/identity.js`);
const { Coord } = require(`${p}src/core/geo.js`);
const { Control_msg } = require("./control.js"); 
const first_names = require("../lib/first-names.json");
const last_names = require("../lib/last-names.json");

/**
 * The emulator is the central coordinator of an emulated network. Emu instantiates peers, each
 * on their own thread, and handles messaging between peers by acting as the hub in a hub-and-spoke
 * pattern. For each peer in the system, two messaging ports are created: A "message" port and a 
 * "control" port. The message port is used for Passerby messages; when Bob's Passerby transport 
 * needs to send a message to Alice, Bob sends that message over the message port, where it's 
 * received by Emu, and Emu forwards it on to Alice. The control port is used to activate peer 
 * functions in the style of an RPC system; when a client wants Bob to perform a geosearch, Emu
 * sends a control message over the control port to Bob instructing Bob to execute a geosearch, and 
 * Bob returns a control message over the control port with his result. Control is currently 
 * unidirectional, meaning Emu can only issue requests, and peers can only issue responses.
 */ 

class Emu {
  static LAT_MINUTES_MILES = 1.15;
  static LON_MINUTES_MILES = 0.91;
  static MINUTES_PER_DEGREE = 60;
  static DEFAULT_PORT = 31337;

  constructor(server) {
    this.world = {};
    this.peer_table = new Map();
    this.server = server;
    this.bootstrap_id = null;
    this.control = new EventEmitter();
    this._generation = 0;
  }

  init() {
    return new Promise((resolve, reject) => {
      /**
       * Listen for messages from the server process
       */ 
      this.server.on("message", (msg) => {
        switch (msg.type) {
          case "state": (() => {
            this.server.send({type: "state", state: this._serialize_world()});
          })();
            
            break;
          case "search": (async () => {
            const peer_state = this._get_peer_by_name(msg.name);

            if (!peer_state) {
              throw new Error("There's no peer by that name");
            }

            const control_port = this.peer_table.get(peer_state.pubstring).control;

            this.send_control(control_port, new Control_msg(this.gen(), "geosearch", [
              peer_state.location.lat, 
              peer_state.location.lon, 
              msg.range
            ]), (port, control_msg) => {
              this.server.send({
                type: "search", 
                search: {
                  lat: peer_state.location.lat,
                  lon: peer_state.location.lon, 
                  range: msg.range,
                  results: control_msg.payload
                }
              });
            });
          })();
            
            break;
          case "move": (async () => {
            const peer_state = this._get_peer_by_name(msg.name);

            if (!peer_state) {
              throw new Error("There's no peer by that name");
            }

            const control_port = this.peer_table.get(peer_state.pubstring).control;

            this.send_control(control_port, new Control_msg(this.gen(), "retract", [
              peer_state.location.lat, 
              peer_state.location.lon, 
              peer_state.pubstring
            ]), (port, control_msg) => {
              this.send_control(control_port, new Control_msg(this.gen(), "assert", [
                msg.lat,
                msg.lon,
                peer_state.pubstring,
                peer_state.pubstring
              ]), (port, control_msg) => {
                peer_state.location.lat = msg.lat;
                peer_state.location.lon = msg.lon;
                this.world[peer_state.pubstring] = peer_state;
                this.server.send({type: "state", state: this._serialize_world()});
              });
            });
          })();

            break;
        }
      });

      /**
       * Spin up the bootstrap node
       */ 
      this.bootstrap_id = new Identity();
      const { port1: control_port1, port2: control_port2 } = new MessageChannel();
      const { port1: msg_port1, port2: msg_port2 } = new MessageChannel();

      msg_port1.on("message", (msg) => {
        const recip_port = this.peer_table.get(msg.recip).msg;
        recip_port.postMessage(msg);
        this._send_cb(msg.rinfo.address, msg.recip, msg.msg);
      });

      const bootstrap_pubstring = this.bootstrap_id.public_key.pubstring();

      const workerData = {
        pubstring: bootstrap_pubstring, 
        bootstrap_pubstring: bootstrap_pubstring,
        control_port: control_port2,
        msg_port: msg_port2
      };

      const peer_worker = new Worker("./peer.js", {
        workerData: workerData, 
        transferList: [control_port2, msg_port2]
      });
    
      this.peer_table.set(workerData.pubstring, {control: control_port1, msg: msg_port1});

      /**
       * When the bootstrap node receives a control message from the emulator, announce it to everyone
       * TODO: This (and a bit of what immediately follows below) is duplicated in Emu.add_peer, is
       * there a way to roll these together? Why can't we add the bootstrap node as a regular peer?
       */ 
      control_port1.on("message", (msg) => {
        this.control.emit(msg.id, control_port1, msg);
      });

      /**
       * Send the start command; when we get the result back, assert our location
       */ 
      this.send_control(control_port1, new Control_msg(this.gen(), "start", [{
        my_addr: bootstrap_pubstring, 
        my_port: Emu.DEFAULT_PORT, 
        my_public_key: this.bootstrap_id.public_key, 
        boot_addr: bootstrap_pubstring,
        boot_port: Emu.DEFAULT_PORT,
        boot_public_key: this.bootstrap_id.public_key
      }]), (port, msg) => {
        this.send_control(control_port1, new Control_msg(this.gen(), "assert", [
          cfg.map_center.lat, 
          cfg.map_center.lon, 
          bootstrap_pubstring, 
          bootstrap_pubstring
        ]), (port, msg) => {
          this.world[bootstrap_pubstring] = new Peer_state(
            "BOOTSTRAP NODE", 
            new Coord(cfg.map_center), 
            bootstrap_pubstring
          );

          /**
           * Tell the server we're ready and be out
           */ 
          this.server.send({type: "emu_ready"});
          resolve();
        });
      });
    });
  }

  add_peer(name, lat, lon) {
    return new Promise((resolve, reject) => {
      const { port1: control_port1, port2: control_port2 } = new MessageChannel();
      const { port1: msg_port1, port2: msg_port2 } = new MessageChannel(); 
      const peer_id = new Identity();
      const pubstring = peer_id.public_key.pubstring();

      msg_port1.on("message", (msg) => {
        const recip_port = this.peer_table.get(msg.recip).msg;
        recip_port.postMessage(msg);
        this._send_cb(msg.rinfo.address, msg.recip, msg.msg);
      });

      const workerData = {
        pubstring: pubstring,
        bootstrap_pubstring: this.bootstrap_id.public_key.pubstring(),
        control_port: control_port2,
        msg_port: msg_port2
      };

      const peer_worker = new Worker("./peer.js", {
        workerData: workerData, 
        transferList: [control_port2, msg_port2]
      });
      
      this.peer_table.set(workerData.pubstring, {control: control_port1, msg: msg_port1});

      /**
       * When this peer receives a control message from the emulator, announce it to everyone
       */ 
      control_port1.on("message", (msg) => {
        this.control.emit(msg.id, control_port1, msg);
      });

      /**
       * Send the start command; when we get the result back, assert our location
       */ 
      this.send_control(control_port1, new Control_msg(this.gen(), "start", [{
        my_addr: pubstring, 
        my_port: Emu.DEFAULT_PORT, 
        my_public_key: peer_id.public_key, 
        boot_addr: this.bootstrap_id.public_key.pubstring(),
        boot_port: Emu.DEFAULT_PORT,
        boot_public_key: this.bootstrap_id.public_key
      }]), (port, msg) => {
        this.send_control(control_port1, new Control_msg(this.gen(), "assert", [
          lat, 
          lon, 
          pubstring, 
         pubstring
        ]), (port, msg) => {
          this.world[pubstring] = new Peer_state(
            name,
            new Coord({lat: lat, lon: lon}), 
            pubstring
          );

          resolve();
        });
      });
    });
  }

  async generate_peers(n_peers) {
    for (let i = 0; i < n_peers; i += 1) {
      const first = first_names.splice(Math.floor(Math.random() * first_names.length), 1)[0];
      const last = last_names.splice(Math.floor(Math.random() * last_names.length), 1)[0];
      const lat_offset_miles = Math.random() * cfg.map_size - (cfg.map_size / 2);
      const lon_offset_miles = Math.random() * cfg.map_size - (cfg.map_size / 2);
      const lat_offset = lat_offset_miles / Emu.LAT_MINUTES_MILES / Emu.MINUTES_PER_DEGREE;
      const lon_offset = lon_offset_miles / Emu.LON_MINUTES_MILES / Emu.MINUTES_PER_DEGREE;
      
      await this.add_peer(
        `${first} ${last}`, 
        cfg.map_center.lat + lat_offset, 
        cfg.map_center.lon + lon_offset
      );

      this.server.send({type: "state", state: this._serialize_world()});
    }
  }

  /**
   * The generation number uniquely identifies control messages; hard to imagine ever issuing enough
   * control messages per second to wrap 0xFFFFFFFF and collide, but if things break, maybe we do lol
   */ 
  gen() {
    this._generation = this._generation < 0xFFFFFFFF ? this._generation + 1 : 0;
    return this._generation;
  }

  send_control(port, msg, callback = () => {}) {
    this.control.once(msg.id, callback);
    port.postMessage(msg);
  }

  _serialize_world() {
    return Object.fromEntries(Object.values(this.world).map(peer_state => {
      const serialized = {
        name: peer_state.name, 
        last_asserted_lat: peer_state.location.lat,
        last_asserted_lon: peer_state.location.lon
      };
     
      return [peer_state.pubstring, serialized];
    }));
  }

  _get_peer_by_name(name) {
    const map_by_name = Object.fromEntries(Object.values(this.world).map(peer_state => {
      return [peer_state.name, peer_state];
    }));

    return map_by_name[name];
  }

  _send_cb(from, to, msg) {
    // console.log(`${from} -> ${to}`);
    this.server.send({type: "traffic", from: from, to: to});
  }
}

class Peer_state {
  constructor(name, location, pubstring) {
    this.name = name;
    this.location = location;
    this.pubstring = pubstring;
  }
}

module.exports = { Emu };
