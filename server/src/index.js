"use strict";

const child_process = require("child_process");
const cfg = require("../park.json");
const p = cfg.passerby_path;
const Crypto = require(`${p}src/core/crypto.js`);
const { Emu } = require("./emu.js");

(async () => {
  await Crypto.Sodium.ready;
  const emu = new Emu(child_process.fork("./http.js"));
  await emu.init();
  await emu.generate_peers(cfg.auto_populate);
})();