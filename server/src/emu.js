"use strict";

const cfg = require("../park.json");
const p = cfg.passerby_path;
const { Passerby } = require(`${p}src/protocol/protocol.js`);
const { Local } = require(`${p}src/transport/local/local.js`);
const { Identity } = require(`${p}src/protocol/identity.js`);
const { Coord } = require(`${p}src/core/geo.js`);
const { Worker, MessageChannel } = require("worker_threads");
const first_names = require("../lib/first-names.json");
const last_names = require("../lib/last-names.json");

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
    this.bootstrap_node = null;
  }

  async init() {
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

    const peer_worker = new Worker("./peer.js", {workerData: workerData, transferList: [control_port2, msg_port2]});
    this.peer_table.set(workerData.pubstring, {control: control_port1, msg: msg_port1});

    /**
     * Send the start command; when we get the result back, assert our location
     */ 
    control_port1.postMessage({command: "start", args: [{
      my_addr: bootstrap_pubstring, 
      my_port: Emu.DEFAULT_PORT, 
      my_public_key: this.bootstrap_id.public_key, 
      boot_addr: bootstrap_pubstring,
      boot_port: Emu.DEFAULT_PORT,
      boot_public_key: this.bootstrap_id.public_key
    }]});

    control_port1.on("message", (msg) => {
      switch (msg.command) {
        case "start": (() => {
          control_port1.postMessage({command: "assert", args: [
            cfg.map_center.lat, 
            cfg.map_center.lon, 
            bootstrap_pubstring, 
            bootstrap_pubstring
          ]});
        })();

          break;
        case "geosearch": (() => {
          this.server.send({type: "search", search: msg.result});
        })();

          break;
      }
    });

    this.world[bootstrap_pubstring] = new Peer_state(
      "BOOTSTRAP NODE", 
      null, 
      new Coord(cfg.map_center), 
      bootstrap_pubstring
    );

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
          
          control_port.postMessage({
            command: "geosearch", 
            args: [peer_state.location.lat, peer_state.location.lon, msg.range]
          });
        })();
          
          break;
        case "move": (async () => {
          const peer_state = this._get_peer_by_name(msg.name);

          if (!peer_state) {
            throw new Error("There's no peer by that name");
          }

          await peer_state.api.retract(
            peer_state.location.lat, 
            peer_state.location.lon, 
            peer_state.pubstring
          );

          await peer_state.api.assert(
            msg.lat, 
            msg.lon, 
            peer_state.pubstring, 
            peer_state.pubstring
          );

          peer_state.location.lat = msg.lat;
          peer_state.location.lon = msg.lon;
          this.world[peer_state.pubstring] = peer_state;
          this.server.send({type: "state", state: this._serialize_world()});
        })();

          break;
      }
    });

    /**
     * Tell the server we're ready
     */ 
    this.server.send({type: "emu_ready"});
  }

  async add_peer(name, lat, lon) {
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

    const peer_worker = new Worker("./peer.js", {workerData: workerData, transferList: [control_port2, msg_port2]});
    this.peer_table.set(workerData.pubstring, {control: control_port1, msg: msg_port1});

    /**
     * Send the start command; when we get the result back, assert our location
     */ 
    control_port1.postMessage({command: "start", args: [{
      my_addr: pubstring, 
      my_port: Emu.DEFAULT_PORT, 
      my_public_key: peer_id.public_key, 
      boot_addr: this.bootstrap_id.public_key.pubstring(),
      boot_port: Emu.DEFAULT_PORT,
      boot_public_key: this.bootstrap_id.public_key
    }]});

    control_port1.on("message", (msg) => {
      switch (msg.command) {
        case "start": (() => {
          control_port1.postMessage({command: "assert", args: [
            lat, 
            lon, 
            pubstring, 
            pubstring
          ]});
        })();

          break;
        case "geosearch": (() => {
          this.server.send({type: "search", search: msg.result});
        })();

          break;
      }
    });

    this.world[pubstring] = new Peer_state(
      name, 
      null, 
      new Coord({lat: lat, lon: lon}), 
      pubstring
    );
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
    }
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
  constructor(name, api, location, pubstring) {
    this.name = name;
    this.api = api;
    this.location = location;
    this.pubstring = pubstring;
  }
}

module.exports = { Emu };