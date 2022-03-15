"use strict"

// TODO: map size, map center, and geo constants should be kept in a shared config with the server
const BORDER = 100;
const ANIMATION_BASE_DURATION = 5;
const SCREENSPACE_SIZE = 1000;
const SCREENSPACE_CENTER = SCREENSPACE_SIZE / 2;
const MAP_SIZE = 20;
const MAP_CENTER_LAT = 40.6761046;
const MAP_CENTER_LON = -73.9735496;
const LAT_MINUTES_MILES = 1.15;
const LON_MINUTES_MILES = 0.91;
const MINUTES_PER_DEGREE = 60;

const LAT_BOUNDARY_OFFSET = MAP_SIZE / 2 / LAT_MINUTES_MILES / MINUTES_PER_DEGREE;
const LON_BOUNDARY_OFFSET = MAP_SIZE / 2 / LON_MINUTES_MILES / MINUTES_PER_DEGREE; 

// Scale factors which affect the transformation from geospace to screenspace
const LAT_S = SCREENSPACE_SIZE / 2 / LAT_BOUNDARY_OFFSET;
const LON_S = SCREENSPACE_SIZE / 2 / LON_BOUNDARY_OFFSET;

function geo_to_screenspace(lat, lon) {
  const lat_px_offset = (MAP_CENTER_LAT - lat) * LAT_S;
  const lon_px_offset = (MAP_CENTER_LON - lon) * LON_S;
  return {x: SCREENSPACE_CENTER + lat_px_offset + BORDER, y: SCREENSPACE_CENTER + lon_px_offset + BORDER};
}

/**
 * TODO: It'd be better if this just constructed a box object and didn't draw it
 */ 
class Bounding {
  constructor({game, lat, lon, range} = {}) {
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
  }
}

/**
 * TODO: It'd be better if this just constructed a peer object and didn't draw it
 */
class Peer {
  static COL_DEFAULT = 0xFFFFFF;
  static COL_SEARCH = 0x80ff00;

  constructor({game, name, lat, lon} = {}) {
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
    this.dot.inputEnabled = true;
    this.nametag.inputEnabled = true;
    this.location.inputEnabled = true;

    this.group.onChildInputOver.add(() => {
      this.palette.group.visible = true;
    });

    this.group.onChildInputOut.add(() => {
      this.palette.group.visible = false;
    });

    game.peer_group.add(this.group);
  }

  color(color) {
    this.dot.tint = color;
    this.nametag.tint = color;
    this.location.tint = color;

    // The following line corrects a bug in Phaser which messes up tinting behavior
    this.dot.graphicsData[0]._fillTint = 0xFFFFFF;
  }
}

/**
* TODO: break this out elsewhere
*/
class Palette {
  constructor({game, peer} = {}) {
    this.peer = peer;

    this.ACTIONS = new Map([
      ["SEARCH 2", [req_search, this.peer.nametag.text, 2]],
      ["SEARCH 5", [req_search, this.peer.nametag.text, 5]],
      ["SEARCH 10", [req_search, this.peer.nametag.text, 10]],
      ["MOVE", null]
    ]);

    this.group = game.add.group();
    this.box = game.add.graphics(0, 0);
    this.box.beginFill(0x8C8C8C);
    this.box.drawRect(0, 0, this.ACTIONS.size * 20, this.ACTIONS.size * 20);
    this.box.endFill();
    this.box.inputEnabled = true;
    this.group.add(this.box);
  
    Array.from(this.ACTIONS.entries()).forEach((pair, i) => {
      const [name, f] = pair;
      
      const action = game.add.text(0, i * 20, `${name}`, {
        fontSize: "14px", 
        fill: "#000000"
      });

      action.inputEnabled = true;

      action.events.onInputOver.add(() => {
        action.fill = "#FF0066";
      });

      action.events.onInputOut.add(() => {
        action.fill = "#000000";
      });

      action.events.onInputDown.add(() => {
        const [f, ...args] = this.ACTIONS.get(name);
        f(...args);
      });

      this.group.add(action);
    });

    this.group.visible = false;

    this.group.onChildInputOver.add(() => {
      this.group.visible = true;
    });

    this.group.onChildInputOut.add(() => {
      this.group.visible = false;
    });

    game.ui_group.add(this.group);
  }
}