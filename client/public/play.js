"use strict";

let last_state = null;

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
     * Inbound state from the server
     */ 
    socket.on("state", (state) => {
      for (const [pubstring, peer] of Object.entries(state)) {
        draw_peer(game, peer.name, peer.last_asserted_lat, peer.last_asserted_lon);
      }

      last_state = state;
    });

    socket.on("search", (search) => {
      console.log(search);
    })

    socket.on("move", (state) => {
      for (const [pubstring, peer] of Object.entries(state)) {
        draw_peer(game, peer.name, peer.last_asserted_lat, peer.last_asserted_lon);
      }

      last_state = state;
    });

    /**
     * Inbound live traffic from the server
     */ 
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
 * Construct the game
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