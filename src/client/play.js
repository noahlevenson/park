"use strict";

async function tick(game) {
  // TODO: clear the screen
  const state = await resource(API.STATE);
  state.forEach(peer => draw_peer(game, peer.name, peer.last_asserted_lat, peer.last_asserted_lon));
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
  tick(game);
  // socket.on("traffic", (from, to) => {
  //   console.log("traffic!");
  // });
})();