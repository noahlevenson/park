"use strict";

const child_process = require("child_process");
const cfg = require("../park.json");
const p = cfg.passerby_path;
const Crypto = require(`${p}src/core/crypto.js`);
const { Emu } = require("./emu.js");

/**
 * Our architecture decouples the emulation engine from the web server. Currently, index.js is
 * the main process and the web server is a child process; however, we may want to flip that: 
 * Imagine an architecture where multiple instances of the emulator run on different machines,
 * each one a child process of a master server. At the server, the world state of each emulator
 * is merged, and each peer is referenced by their name and emulation instance, enabling 
 * interprocess communication between peers hosted at different emulation instances...
 */ 

(async () => {
  await Crypto.Sodium.ready;
  const emu = new Emu(child_process.fork("./http.js"));
  await emu.init();
  await emu.generate_peers(cfg.auto_populate);
})();