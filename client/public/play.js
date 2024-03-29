"use strict";

/**
 * Game logic
 */ 
const play = {
  world: null,

  preload: () => {
    game.load.image("clear_button", "img/clear.png", 50, 50);
    game.load.image("crosshair_cursor", "img/crosshair_cursor.png", 60, 60);
    game.load.image("map", "img/map.png", 1000, 1000);
  },

  create: () => {
    this.world = new World(io(), game);

    /**
     * Set up the groups for z-ordering
     */
    this.world.bg_group = game.add.group();
    this.world.peer_group = game.add.group();
    this.world.traffic_group = game.add.group();
    this.world.bounding_group = game.add.group();
    this.world.ui_group = game.add.group();

    /**
     * Add the background (we use the background to intercept clicks that don't target game objects)
     */
    // this.world.bg = game.add.graphics(0, 0);
    // this.world.bg.beginFill(World.BG_COLOR);
    // this.world.bg.drawRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    
    this.world.bg = game.add.sprite(BORDER, BORDER, "map");
    this.world.bg.alpha = 0.4;

    this.world.bg.inputEnabled = true; 
    this.world.bg_group.add(this.world.bg);

    /**
     * Build the crosshair cursor
     */ 
    this.world.crosshair_cursor = game.add.sprite(0, 0, "crosshair_cursor");
    this.world.crosshair_cursor.visible = false;

    /**
     * Set up the clear button
     */ 
    const clear_button = game.add.sprite(10, 10, "clear_button");
    clear_button.tint = 0x8C8C8C;

    clear_button.events.onInputOver.add(() => {
      clear_button.tint = 0xFFFFFF;
    });

    clear_button.events.onInputOut.add(() => {
      clear_button.tint = 0x8C8C8C;
    });

    clear_button.events.onInputDown.add(() => {
      this.world.cls();
      clear_button.tint = 0xFF0066;
    });

    clear_button.events.onInputUp.add(() => {
      clear_button.tint = 0xFFFFFF;
    });

    clear_button.inputEnabled = true;
    clear_button.input.useHandCursor = true;

    /**
     * Make graphics for a message sprite
     */ 
    this.world.msg_gfx = game.make.graphics(0, 0);
    this.world.msg_gfx.beginFill(0xFFFFFF);
    this.world.msg_gfx.drawCircle(0, 0, 5);
    this.world.msg_gfx.endFill();

    /**
     * Get the first state!
     */ 
    this.world.req_state();
  },

  update: () => {
    // Persistently draw the crosshair cursor to make life simple (we toggle its visibility elsewhere)
    this.world.crosshair_cursor.x = game.input.mousePointer.x - 30;
    this.world.crosshair_cursor.y = game.input.mousePointer.y - 30; 
  }
}

/**
 * Construct the game and start!
 */ 
const cfg = {
  width: CANVAS_SIZE,
  height: CANVAS_SIZE,
  multiTexture: true,
  parent: "playfield",
  enableDebug: false,
  renderer: Phaser.CANVAS,
  antialias: false,
};

const game = new Phaser.Game(cfg);
game.state.add("play", play);
game.state.start("play");