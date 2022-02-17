"use strict";

const cfg = require("../park.json");
const p = cfg.passerby_path;
const { Passerby } = require(`${p}src/protocol/protocol.js`);
const { Local } = require(`${p}src/transport/local/local.js`);
const { Identity } = require(`${p}src/protocol/identity.js`);
const { Coord } = require(`${p}src/core/geo.js`);
const first_names = require("../lib/first-names.json");
const last_names = require("../lib/last-names.json");

class Emu {
  static LAT_MINUTES_MILES = 1.15;
  static LON_MINUTES_MILES = 0.91;
  static MINUTES_PER_DEGREE = 60;
  static DEFAULT_PORT = 31337;

  constructor(server) {
    this.world = {};
    this.peer_map = new Map();
    this.server = server;
    this.bootstrap_id = null;
    this.bootstrap_node = null;
  }

  async init() {
    /**
     * Spin up the bootstrap node
     */ 
    this.bootstrap_id = new Identity();

    const local = new Local({
      my_addr: this.bootstrap_id.public_key.pubstring(), 
      my_port: Emu.DEFAULT_PORT, 
      peer_map: this.peer_map,
      send_cb: this._send_cb.bind(this)
    });

    this.bootstrap_node = new Passerby({transport: local});

    await this.bootstrap_node.start({
      my_addr: this.bootstrap_id.public_key.pubstring(), 
      my_port: Emu.DEFAULT_PORT, 
      my_public_key: this.bootstrap_id.public_key,
      boot_addr: this.bootstrap_id.public_key.pubstring(),
      boot_port: Emu.DEFAULT_PORT,
      boot_public_key: this.bootstrap_id.public_key
    });

    await this.bootstrap_node.assert(
      cfg.map_center.lat, 
      cfg.map_center.lon, 
      this.bootstrap_id.public_key.pubstring(),
      this.bootstrap_id.public_key.pubstring()
    );

    this.world[this.bootstrap_id.public_key.pubstring()] = new Peer_state(
      "BOOTSTRAP NODE", 
      this.bootstrap_node, 
      new Coord(cfg.map_center), 
      this.bootstrap_id.public_key.pubstring()
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

          const search = await peer_state.api.geosearch(
            peer_state.location.lat, 
            peer_state.location.lon, 
            msg.range
          );

          this.server.send({type: "search", search: search});
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
    const peer_id = new Identity();
    const pubstring = peer_id.public_key.pubstring();
   
    const peer = new Passerby({
      transport: new Local({my_addr: pubstring, peer_map: this.peer_map, send_cb: this._send_cb.bind(this)})
    });

    await peer.start({
      my_addr: pubstring,
      my_port: Emu.DEFAULT_PORT,
      my_public_key: peer_id.public_key,
      boot_addr: this.bootstrap_id.public_key.pubstring(),
      boot_port: Emu.DEFAULT_PORT,
      boot_public_key: this.bootstrap_id.public_key
    });

    await peer.assert(lat, lon, pubstring, pubstring);
    this.world[pubstring] = new Peer_state(name, peer, new Coord({lat: lat, lon: lon}), pubstring);
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
        cfg.map_center.lon + lon_offset,
        this._send_cb.bind(this)
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
    console.log(`${from} -> ${to}`);
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