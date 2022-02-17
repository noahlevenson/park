"use strict";

const fs = require("fs");
const http = require("http");
const url = require("url");
const { Server } = require("socket.io");

const HTTP_HOST = "localhost";
const HTTP_PORT = 9000;
const CLIENT_PATH = "../../client/public";

/**
 * Listen for inbound HTTP requests
 */ 
const request_listener = async (req, res) => {
  const parsed = url.parse(req.url, true);
  await service(parsed, res);
};

const server = http.createServer(request_listener);
const io = new Server(server);
let clients = 0

/**
 * Listen for inbound websocket messages from the client
 */ 
io.on("connection", socket => {
  clients += 1;
  console.log(`A client connected... total clients: ${clients}`);

  socket.on("state", () => {
    process.send({type: "state"});
  });

  socket.on("search", (name, range) => {
    process.send({type: "search", name: name, range: range});
  });

  socket.on("move", (name, lat, lon) => {
    process.send({type: "move", name: name, lat: lat, lon: lon});
  });

  socket.on("disconnect", () => {
    clients -= 1;
    console.log(`Client disconnected... total clients: ${clients}`);
  });
});

/**
 * Listen for IPC from the main process
 */ 
process.on("message", (msg) => {
  switch (msg.type) {
    case "state":
      io.emit("state", msg.state);
      break;
    case "search":
      io.emit("search", msg.search);
      break;
    case "traffic":
      io.emit("traffic", msg.from, msg.to);
      break;
    case "emu_ready":
      const s = new Array(68 - 15 - HTTP_HOST.length - HTTP_PORT.toString().length).fill(" ").join("");

      server.listen(HTTP_PORT, HTTP_HOST, () => {
        console.log("+--------------------------------------------------------------------+");
        console.log("|                                                                    |")
        console.log("| passerby park server                                               |");
        console.log(`| listening on ${HTTP_HOST}:${HTTP_PORT}${s}|`);
        console.log("|                                                                    |")
        console.log("+--------------------------------------------------------------------+");
      });
  }
});

async function service(parsed, res) {
  switch (parsed.pathname) {
    case "/":
      fs.readFile(`${CLIENT_PATH}/index.html`, (err, contents) => {
        if (err) {
          throw new Error(err);
        }
        
        res.setHeader("Content-Type", "text/html");
        res.writeHead(200);
        res.end(contents);
      });

      break;
    default:
      fs.readFile(`${CLIENT_PATH}${parsed.pathname}`, (err, contents) => {
        if (err) {
          res.writeHead(404);
          res.end("Not found");
        }
        
        // TODO: Set content type?
        res.writeHead(200);
        res.end(contents);
      });
  }
}

module.exports = { service };