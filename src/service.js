"use strict";

const fs = require("fs");

const CLIENT_PATH = "./client";

async function service(parsed, res, world) {
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
    case "/state":
      res.setHeader("Content-Type", "application/json");
      res.writeHead(200);

      // Transform the world Map into some interesting json
      const json = Object.fromEntries(Array.from(world.values()).map(peer_state => {
        return [peer_state.pubstring, {
          name: peer_state.name, 
          last_asserted_lat: peer_state.location.lat, 
          last_asserted_lon: peer_state.location.lon
        }];
      }));

      res.end(JSON.stringify(json));
      break;
    case "/move":
      res.setHeader("Content-Type", "application/json");
      
      if (!parsed.query.name || !parsed.query.lat || !parsed.query.long) {
        res.writeHead(500);
        res.end("Bad request");
      } else {
        res.writeHead(200);

        // Find the peer in the global state table by name, assert their new location
        const table_by_name = new Map(Array.from(world.values()).map(peer_state => {
          return [peer_state.name, peer_state];
        }));

        const peer_state = table_by_name.get(parsed.query.name);
        const api = peer_state.api;
        const pubstring = peer_state.pubstring;

        if (!api) {
          throw new Error("There's no peer by that name");
        } 

        peer_state.location.lat = parseFloat(parsed.query.lat);
        peer_state.location.lon = parseFloat(parsed.query.long);
        
        // I sure hope lat and long are valid values
        await api.retract(peer_state.location.lat, peer_state.location.lon, pubstring);
        await api.assert(peer_state.location.lat, peer_state.location.lon, pubstring, pubstring);
        world.set(pubstring, peer_state);
        res.end("OK");
      }

      break;
    case "/search":
      res.setHeader("Content-Type", "application/json");

      if (!parsed.query.name || !parsed.query.range) {
        res.writeHead(500);
        res.end("Bad request");
      } else {
        const table_by_name = new Map(Array.from(world.values()).map(peer_state => {
          return [peer_state.name, peer_state];
        }));

        const peer_state = table_by_name.get(parsed.query.name);
        const api = peer_state.api;

        if (!api) {
          throw new Error("There's no peer by that name");
        } 
        
        // I sure hope range is a valid value
        const search = await api.geosearch(
          peer_state.location.lat, 
          peer_state.location.lon, 
          parseFloat(parsed.query.range)
        );

        console.log(search);
        res.end(JSON.stringify(search));
      }

      break;
    default:
      fs.readFile(`${CLIENT_PATH}${parsed.pathname}`, (err, contents) => {
        if (err) {
          res.writeHead(404);
          res.end("Bad request");
        }
        
        // TODO: Set content type?
        res.writeHead(200);
        res.end(contents);
      });
  }
}

module.exports = { service };