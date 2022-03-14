"use strict";

const socket = io();
let last_state = null;
const peers = new Map();
const squares = [];

/**
 * API request wrappers
 */ 
function req_state() {
  socket.emit("state");
}

function req_search(name, dist) {
  socket.emit("search", name, dist);
}

function req_move(name, lat, lon) {
  socket.emit("move", name, lat, lon);
}

/**
 * Game logic
 */ 
const play = {
  create: () => {
    /**
     * Make graphics for a message sprite
     */ 
    const msg_gfx = game.make.graphics(0, 0);
    msg_gfx.beginFill(0xFFFFFF);
    msg_gfx.drawCircle(0, 0, 5);
    msg_gfx.endFill();

    /**
     * Handle messages from the server
     */ 
    socket.on("state", (state) => {
      for (const [pubstring, peer] of Object.entries(state)) {
        /**
         * If we've already created a peer object for this peer, lerp it to their new location -- and
         * if we haven't, then create a new peer object for this peer
         */ 
        if (peers[pubstring]) {
          const old_loc = geo_to_screenspace(
            last_state[pubstring].last_asserted_lat, 
            last_state[pubstring].last_asserted_lon
          );

          const new_loc = geo_to_screenspace(peer.last_asserted_lat, peer.last_asserted_lon);
          const dist = game.math.max(game.math.distance(old_loc.x, old_loc.y, new_loc.x, new_loc.y), 100);
          const duration = dist * ANIMATION_BASE_DURATION;

          // Truly hacky way to update this peer's lat/lon text element
          peers[pubstring].children[2].setText(`${peer.last_asserted_lat}, ${peer.last_asserted_lon}`)

          const move_tween = game.add.tween(peers[pubstring].position).
            to({x: new_loc.x, y: new_loc.y}, duration, Phaser.Easing.Linear.None, true, 0, 0, false);
        } else {
          peers[pubstring] = add_peer(game, peer.name, peer.last_asserted_lat, peer.last_asserted_lon);
        }
      }

      last_state = state;
    });

    socket.on("search", (search) => {
      squares.push(add_square(game, search.lat, search.lon, search.range));
      console.log(search.results.map(pair => last_state[pair[1]].name));
      console.log(`Elapsed: ${search.elapsed}ms`);
    });

    socket.on("traffic", (traffic_map) => {
      for (const [key, tuple] of Object.entries(traffic_map)) {
        const [from, to, count] = tuple;

        // TODO: If we make our boot process cleaner, we won't need these
        if (last_state === null || !last_state[from] || !last_state[to]) {
          return;
        } 

        const start = geo_to_screenspace(
          last_state[from].last_asserted_lat, 
          last_state[from].last_asserted_lon
        );

        const end = geo_to_screenspace(
          last_state[to].last_asserted_lat, 
          last_state[to].last_asserted_lon
        );

        const msg_sprite = game.add.sprite(start.x, start.y, msg_gfx.generateTexture());

        if (count < 5) {
          msg_sprite.tint = 0x77b300;
        } else if (count < 15) {
          msg_sprite.tint = 0xffff00;
        } else {
          msg_sprite.tint = 0xff0000;
        }

        /**
         * Alternate color code idea: Give message sprites a brightness value along a single hue
         * const r = Math.min(0xFF, 0x99 * count);
         * const g = Math.min(0xFF, 0x01 * count);
         * const b = Math.min(0xFF, 0x01 * count);
         * msg_sprite.tint = (r << 16) | (g << 8) | b;
         */ 
    
        msg_sprite.anchor.setTo(0.5, 0.5);

        const dist = game.math.max(game.math.distance(start.x, start.y, end.x, end.y), 100);
        const duration = dist * ANIMATION_BASE_DURATION;
        let msg_tween;

        // It's a loopback message, so we do a special yoyo animation
        if (start.x === end.x && start.y === end.y) {
          msg_tween = game.add.tween(msg_sprite.position).
            to({x: start.x, y: end.y - dist}, duration, Phaser.Easing.Linear.None, true, 0, 0, true);
        } else {
          msg_tween = game.add.tween(msg_sprite.position).
            to({x: end.x, y: end.y}, duration, Phaser.Easing.Linear.None, true, 0, 0, false);
        }

        msg_tween.onComplete.addOnce(() => {
          msg_sprite.destroy();
        });
      }
    });
  }
}

/**
 * Construct the game and start!
 */ 
const cfg = {
  width: SCREENSPACE_SIZE + BORDER * 2,
  height: SCREENSPACE_SIZE + BORDER * 2,
  multiTexture: true,
  parent: "playfield",
  enableDebug: false,
  renderer: Phaser.CANVAS,
  antialias: false,
};

const game = new Phaser.Game(cfg);
game.state.add("play", play);
game.state.start("play");
req_state();