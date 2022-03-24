"use strict";

class World {
  static BG_COLOR = 0x000000;

  constructor(socket, game) {
    this.socket = socket;
    this.game = game;
    this.last_state = null;
    this.peers = new Map();
    this.boundings = [];
    this.bg_group;
    this.peer_group;
    this.traffic_group;
    this.bounding_group;
    this.ui_group;
    this.crosshair_cursor;
    this.msg_gfx;
    this.bg;

    /**
     * Handle state messages from the server
     */ 
    this.socket.on("state", (state) => {
      for (const [pubstring, peer] of Object.entries(state)) {
        /**
         * If we've already created a peer object for this peer, lerp it to their new location -- and
         * if we haven't, then create a new peer object for this peer
         */ 
        if (this.peers.has(pubstring)) {
          const old_loc = geo_to_screenspace(
            this.last_state[pubstring].last_asserted_lat, 
            this.last_state[pubstring].last_asserted_lon
          );

          const new_loc = geo_to_screenspace(peer.last_asserted_lat, peer.last_asserted_lon);
          
          const dist = this.game.math.max(
            game.math.distance(old_loc.x, old_loc.y, new_loc.x, new_loc.y), 
            100
          );
          
          const duration = dist * ANIMATION_BASE_DURATION;

          this.peers.get(pubstring).location.setText(`${peer.last_asserted_lat}, ${peer.last_asserted_lon}`);
          this.peers.get(pubstring).move(new_loc.x, new_loc.y, duration);
        } else {
          this.peers.set(pubstring, new Peer({
            game: this.game, 
            world: this,
            name: peer.name, 
            lat: peer.last_asserted_lat, 
            lon: peer.last_asserted_lon
          }));
        }
      }

      this.last_state = state;
    });

    /**
     * Handle search messages from the server
     */ 
    this.socket.on("search", (search) => {
      this.boundings.push(new Bounding({
        game: this.game, 
        world: this,
        lat: search.lat, 
        lon: search.lon, 
        range: search.range
      }));

      search.results.forEach((pair) => {
        this.peers.get(pair[1]).color(Peer.COL_SEARCH);
      });

      console.log(search.results.map(pair => this.last_state[pair[1]].name));
      console.log(`Elapsed: ${search.elapsed}ms`);
    });

    /**
     * Handle traffic messages from the server
     */ 
    this.socket.on("traffic", (traffic_map) => {
      for (const [key, tuple] of Object.entries(traffic_map)) {
        const [from, to, count] = tuple;

        // TODO: If we make our boot process cleaner, we won't need these
        if (this.last_state === null || !this.last_state[from] || !this.last_state[to]) {
          return;
        } 

        const start = geo_to_screenspace(
          this.last_state[from].last_asserted_lat, 
          this.last_state[from].last_asserted_lon
        );

        const end = geo_to_screenspace(
          this.last_state[to].last_asserted_lat, 
          this.last_state[to].last_asserted_lon
        );

        const msg_sprite = this.game.add.sprite(start.x, start.y, this.msg_gfx.generateTexture());
        this.traffic_group.add(msg_sprite);

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

        const dist = this.game.math.max(game.math.distance(start.x, start.y, end.x, end.y), 100);
        const duration = dist * ANIMATION_BASE_DURATION;
        let msg_tween;

        // It's a loopback message, so we do a special yoyo animation
        if (start.x === end.x && start.y === end.y) {
          msg_tween = this.game.add.tween(msg_sprite.position).
            to({x: start.x, y: end.y - dist}, duration, Phaser.Easing.Linear.None, true, 0, 0, true);
        } else {
          msg_tween = this.game.add.tween(msg_sprite.position).
            to({x: end.x, y: end.y}, duration, Phaser.Easing.Linear.None, true, 0, 0, false);
        }

        msg_tween.onComplete.addOnce(() => {
          msg_sprite.destroy();
        });
      }
    });
  }

  cls() {
    for (var [key, peer] of this.peers) {
      peer.color(Peer.COL_DEFAULT);
    }

    this.boundings.forEach(bounding => bounding.box.destroy());
    this.boundings = [];
  }

  /**
   * API request wrappers
   */ 
  req_state() {
    this.socket.emit("state");
  }

  req_search(name, dist) {
    this.socket.emit("search", name, dist);
  }

  req_move(name, lat, lon) {
    this.socket.emit("move", name, lat, lon);
  }
}

/**
 * TODO: It'd be better if this just constructed a box object and didn't draw it
 */ 
class Bounding {
  constructor({game, world, lat, lon, range} = {}) {
    const {x, y} = geo_to_screenspace(lat, lon);
    const lat_offset = range / LAT_MINUTES_MILES / MINUTES_PER_DEGREE * LAT_S;
    const lon_offset = range / LON_MINUTES_MILES / MINUTES_PER_DEGREE * LON_S;
    this.x = x - lat_offset;
    this.y = y - lon_offset;
    this.w = lat_offset * 2;
    this.h = lon_offset * 2;
    this.box = game.add.graphics(0, 0);
    this.box.lineStyle(4, Peer.COL_SEARCH, 1.0);
    this.box.drawRect(this.x, this.y, this.w, this.h);
    world.bounding_group.add(this.box);
  }
}

/**
 * TODO: It'd be better if this just constructed a peer object and didn't draw it
 */
class Peer {
  static COL_DEFAULT = 0xFFFFFF;
  static COL_SEARCH = 0x80ff00;

  constructor({game, world, name, lat, lon} = {}) {
    this.game = game;
    this.world = world;
    this.group = game.add.group();
    this.group.position = geo_to_screenspace(lat, lon);
    this.dot = game.add.graphics(0, 0);
    this.dot.beginFill(Peer.COL_DEFAULT);
    this.dot.drawCircle(0, 0, 10);
    this.dot.endFill();
    this.nametag = game.add.text(0, 0 + 20, `${name}`, {fontSize: "12px", fill: "#FFFFFF"});
    this.nametag.anchor.setTo(0.5, 0.5);
    this.location = game.add.text(0, 0 + 40, `${lat}, ${lon}`, {fontSize: "12px", fill: "#FFFFFF"});
    this.location.anchor.setTo(0.5, 0.5);
    this.group.add(this.dot);
    this.group.add(this.nametag);
    this.group.add(this.location);
    this.palette = new Palette({game: game, peer: this});
    this.palette.group.position = {x: this.group.position.x + 20, y: this.group.position.y};

    this.group.onChildInputDown.add(() => {
      for (const [pubstring, peer] of this.world.peers) {
        peer.palette.group.visible = false;
      }

      this.palette.group.visible = true;

      this.world.bg.events.onInputDown.add(() => {
        this.palette.group.visible = false;
      });
    });

    this.world.peer_group.add(this.group);
    this.enable();
  }

  color(color) {
    this.dot.tint = color;
    this.nametag.tint = color;
    this.location.tint = color;

    // The following line corrects a bug in Phaser which messes up tinting behavior
    this.dot.graphicsData[0]._fillTint = 0xFFFFFF;
  }

  move(x, y, duration) {
    const move_tween = this.game.add.tween(this.group.position).
      to({x: x, y: y}, duration, Phaser.Easing.Linear.None, true, 0, 0, false);
    this.palette.group.position = {x: x, y: y};
  }

  enable() {
    this.dot.inputEnabled = true;
    this.nametag.inputEnabled = true;
    this.location.inputEnabled = true;
    this.dot.input.useHandCursor = true;
    this.nametag.input.useHandCursor = true;
    this.location.input.useHandCursor = true;
  }

  disable() {
    this.dot.inputEnabled = false;
    this.nametag.inputEnabled = false;
    this.location.inputEnabled = false;
  }
}

class Palette {
  constructor({game, peer} = {}) {
    this.peer = peer;
    this.game = game;

    this.ACTIONS = new Map([
      ["SEARCH 0.5", [this._search, this.peer.nametag.text, 0.5]],
      ["SEARCH 1", [this._search, this.peer.nametag.text, 1]],
      ["SEARCH 3", [this._search, this.peer.nametag.text, 3]],
      ["MOVE", [this._move]]
    ]);

    this.group = game.add.group();
    this.box = game.add.graphics(0, 0);
    this.box.beginFill(0x8C8C8C);
    this.box.drawRect(0, 0, 10 + this.ACTIONS.size * 20, this.ACTIONS.size * 20);
    this.box.endFill();
    this.actions = [];
    this.group.add(this.box);
  
    Array.from(this.ACTIONS.entries()).forEach((pair, i) => {
      const [name, f] = pair;
      
      const action = game.add.text(0, i * 20, `${name}`, {
        fontSize: "14px", 
        fill: "#000000"
      });

      action.inputEnabled = true;
      action.input.useHandCursor = true;

      action.events.onInputOver.add(() => {
        action.fill = "#FF0066";
      });

      action.events.onInputOut.add(() => {
        action.fill = "#000000";
      });

      action.events.onInputDown.add(() => {
        this.group.visible = false;
        const [f, ...args] = this.ACTIONS.get(name);
        f.bind(this)(...args);
      });

      this.actions.push(action);
      this.group.add(action);
    });

    this.group.visible = false;
    this.peer.world.ui_group.add(this.group);
  }

  _search(name, range) {
    this.peer.world.req_search(name, range);
  }

  _move() {
    /**
     * Disabling the peers and actions (and re-enabling them below) is necessary to prevent some
     * weird buggy issues with hiding the mouse cursor :(
     */ 
    for (const [pubstring, peer] of this.peer.world.peers) {
      peer.disable();
    }

    this.actions.forEach((action) => {
      action.inputEnabled = false;
      action.input.useHandCursor = false;
    });

    this.game.canvas.style.cursor = "none";
    this.peer.world.crosshair_cursor.visible = true;

    this.game.input.onDown.add(() => {
      for (const [pubstring, peer] of this.peer.world.peers) {
        peer.enable();
      }

      this.actions.forEach((action) => {
        action.inputEnabled = true;
        action.input.useHandCursor = true;
      });

      const coord = screenspace_to_geo(
        this.game.input.mousePointer.x,
        this.game.input.mousePointer.y
      );
      
      this.peer.world.req_move(this.peer.nametag.text, coord.lat, coord.lon);
      this.peer.world.crosshair_cursor.visible = false;
      this.game.canvas.style.cursor = "default";
      this.game.input.onDown.removeAll();
    });
  }
}