"use strict";

const cfg = require("../park.json");
const p = cfg.passerby_path;
const { Passerby } = require(`${p}src/protocol/protocol.js`);
const { Local } = require(`${p}src/transport/local/local.js`);
const { Identity } = require(`${p}src/protocol/identity.js`);
const { Pht, key } = require(`${p}src/pht/key.js`);
const { Coord } = require(`${p}src/core/geo.js`);
const { Bigboy } = require(`${p}src/core/types/bigboy.js`);
const Crypto = require(`${p}src/core/crypto.js`);
const first_names = require("../lib/first-names.json");
const last_names = require("../lib/last-names.json");

/**
 * 'world' is the global state table, mapping pubstrings to Peer_state objects
 * 'peer_map' is the map used by Passerby's local transport
 */ 

const world = new Map();
const peer_map = new Map();
const port = 31337;
let bootstrap_node = null;

class Peer_state {
  constructor(name, api, location) {
    this.name = name;
    this.api = api;
    this.location = location;
  }
}

async function add_peer(name, lat, lon) {
  const peer_id = new Identity();
  const pubstring = peer_id.public_key.pubstring();
  const peer = new Passerby({transport: new Local({my_addr: pubstring, peer_map: peer_map})})

  await peer.start({
    my_addr: pubstring,
    my_port: port,
    my_public_key: peer_id.public_key,
    boot_addr: bootstrap_node.public_key.pubstring(),
    boot_port: port,
    boot_public_key: bootstrap_node.public_key
  });

  await peer.assert(lat, lon, pubstring);

  world.set(
    pubstring, 
    new Peer_state(name, peer, new Coord({lat: lat, lon: lon}))
  );
}

async function generate_peers(n_peers) {
  for (let i = 0; i < n_peers; i += 1) {
    const first = first_names.splice(Math.floor(Math.random() * first_names.length), 1)[0];
    const last = last_names.splice(Math.floor(Math.random() * last_names.length), 1)[0];
    const lat_offset_miles = Math.random() * cfg.map_size - (cfg.map_size / 2);
    const lon_offset_miles = Math.random() * cfg.map_size - (cfg.map_size / 2);
    const lat_offset = lat_offset_miles / 1.15 / 60;
    const lon_offset = lon_offset_miles / 0.91 / 60;
    await add_peer(`${first} ${last}`, cfg.map_center.lat + lat_offset, cfg.map_center.lon + lon_offset);
  }
}

(async () => {
  await Crypto.Sodium.ready;
  bootstrap_node = new Identity();

  const local = new Local({
    my_addr: bootstrap_node.public_key.pubstring(), 
    my_port: port, 
    peer_map: peer_map
  });
 
  const bootstrap = new Passerby({transport: local});
  
  await bootstrap.start({
    my_addr: bootstrap_node.public_key.pubstring(), 
    my_port: port, 
    my_public_key: bootstrap_node.public_key,
    boot_addr: bootstrap_node.public_key.pubstring(),
    boot_port: port,
    boot_public_key: bootstrap_node.public_key
  });

  await bootstrap.assert(
    cfg.map_center.lat, 
    cfg.map_center.lon, 
    bootstrap_node.public_key.pubstring()
  );

  world.set(
    bootstrap_node.public_key.pubstring(), 
    new Peer_state("BOOTSTRAP NODE", bootstrap, new Coord(cfg.map_center))
  );
})();