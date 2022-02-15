"use strict";

const MSG_ANIM = 5;
let last_state = null;

async function tick(game) {
  // TODO: clear the screen
  const state = await resource(API.STATE);

  for (const [pubstring, peer] of Object.entries(state)) {
    draw_peer(game, peer.name, peer.last_asserted_lat, peer.last_asserted_lon)
  }

  return state;
}

(async () => {
  /**
   * Construct the game
   */ 
  const cfg = {
    width: SCREENSPACE_SIZE + 100,
    height: SCREENSPACE_SIZE + 100,
    multiTexture: false,
    parent: "playfield",
    enableDebug: false,
    renderer: Phaser.CANVAS,
    antialias: true,
  };

  const game = new Phaser.Game(cfg);
  last_state = await tick(game);

  /**
   * Make graphics for a message sprite
   */ 
  const msg_gfx = game.make.graphics(0, 0);
  msg_gfx.beginFill(0xEB34E1);
  msg_gfx.drawCircle(0, 0, 5);
  msg_gfx.endFill();

  /**
   * Handle realtime message events between peers
   */ 
  socket.on("traffic", (from, to) => {
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
    const duration = dist * MSG_ANIM;
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
})();