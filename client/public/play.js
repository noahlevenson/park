"use strict";

const socket = io();
let last_state = null;
let peers = new Map();

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
    msg_gfx.beginFill(0xEB34E1);
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
          const duration = dist * MSG_ANIMATION_BASE_DURATION;

          const move_tween = game.add.tween(peers[pubstring].position).
            to({x: new_loc.x, y: new_loc.y}, duration, Phaser.Easing.Linear.None, true, 0, 0, false);
        } else {
          peers[pubstring] = add_peer(game, peer.name, peer.last_asserted_lat, peer.last_asserted_lon);
        }
      }

      last_state = state;
    });

    socket.on("search", (search) => {
      console.log(search);
    })

    socket.on("traffic", (from, to) => {
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
      msg_sprite.anchor.setTo(0.5, 0.5);

      const dist = game.math.max(game.math.distance(start.x, start.y, end.x, end.y), 100);
      const duration = dist * MSG_ANIMATION_BASE_DURATION;
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
    });
  }
}

/**
 * Construct the game and start!
 */ 
const cfg = {
  width: SCREENSPACE_SIZE,
  height: SCREENSPACE_SIZE,
  multiTexture: false,
  parent: "playfield",
  enableDebug: false,
  renderer: Phaser.CANVAS,
  antialias: false,
};

const game = new Phaser.Game(cfg);
game.state.add("play", play);
game.state.start("play");
req_state();