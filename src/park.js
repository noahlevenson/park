"use strict";

const http = require("http");
const url = require("url");
const cfg = require("../park.json");
const p = cfg.passerby_path;
const { service } = require("./service.js");
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

const HTTP_HOST = "localhost";
const HTTP_PORT = 9000;

const LAT_MINUTES_MILES = 1.15;
const LON_MINUTES_MILES = 0.91;
const MINUTES_PER_DEGREE = 60;

const world = new Map();
const peer_map = new Map();
const port = 31337;
let bootstrap_node = null;

class Peer_state {
  constructor(name, api, location, pubstring) {
    this.name = name;
    this.api = api;
    this.location = location;
    this.pubstring = pubstring;
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

  await peer.assert(lat, lon, pubstring, pubstring);

  world.set(
    pubstring, 
    new Peer_state(name, peer, new Coord({lat: lat, lon: lon}), pubstring)
  );
}

async function generate_peers(n_peers) {
  for (let i = 0; i < n_peers; i += 1) {
    const first = first_names.splice(Math.floor(Math.random() * first_names.length), 1)[0];
    const last = last_names.splice(Math.floor(Math.random() * last_names.length), 1)[0];
    const lat_offset_miles = Math.random() * cfg.map_size - (cfg.map_size / 2);
    const lon_offset_miles = Math.random() * cfg.map_size - (cfg.map_size / 2);
    const lat_offset = lat_offset_miles / LAT_MINUTES_MILES / MINUTES_PER_DEGREE;
    const lon_offset = lon_offset_miles / LON_MINUTES_MILES / MINUTES_PER_DEGREE;
    await add_peer(`${first} ${last}`, cfg.map_center.lat + lat_offset, cfg.map_center.lon + lon_offset);
  }
}

/**
 * STARTUP
 */ 
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
    bootstrap_node.public_key.pubstring(),
    bootstrap_node.public_key.pubstring()
  );

  world.set(
    bootstrap_node.public_key.pubstring(), 
    new Peer_state(
      "BOOTSTRAP NODE", 
      bootstrap, 
      new Coord(cfg.map_center), 
      bootstrap_node.public_key.pubstring()
    )
  );

  await generate_peers(cfg.auto_populate);

  const request_listener = async (req, res) => {
    const parsed = url.parse(req.url, true);
    await service(parsed, res, world);
  };

  const server = http.createServer(request_listener);
  const s = new Array(68 - 15 - HTTP_HOST.length - HTTP_PORT.toString().length).fill(" ").join("");

  await server.listen(HTTP_PORT, HTTP_HOST, () => {
    console.log("+--------------------------------------------------------------------+");
    console.log("|                                                                    |")
    console.log("| passerby park server                                               |");
    console.log(`| listening on ${HTTP_HOST}:${HTTP_PORT}${s}|`);
    console.log("|                                                                    |")
    console.log("+--------------------------------------------------------------------+");
  });
})();