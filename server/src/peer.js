"use strict";

const cfg = require("../park.json");
const p = cfg.passerby_path;
const Crypto = require(`${p}src/core/crypto.js`);
const { Public_key } = require(`${p}src/protocol/identity.js`);
const { Passerby } = require(`${p}src/protocol/protocol.js`);
const { Threaded } = require("./threaded.js");
const { workerData } = require("worker_threads");

const DEFAULT_PORT = 31337;

(async () => {
  await Crypto.Sodium.ready;
  const {pubstring, bootstrap_pubstring, control_port, msg_port} = workerData;
  const pubkey = Public_key.from_pubstring(pubstring);
  const bootstrap_pubkey = Public_key.from_pubstring(bootstrap_pubstring);

  const threaded = new Threaded({
    my_addr: pubstring, 
    my_port: DEFAULT_PORT,
    worker_port: msg_port,
  });

  const passerby = new Passerby({transport: threaded});

  control_port.on("message", async (msg) => {
    const result = await passerby[msg.command](...msg.args);
    control_port.postMessage({command: msg.command, result: result});
  });
})();