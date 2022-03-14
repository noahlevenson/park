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
 * TODO: It'd be better if this just constructed a peer object and didn't draw it
 */
function add_peer(game, name, lat, lon) {
  const {x, y} = geo_to_screenspace(lat, lon);

  const peer_group = game.add.group();
  peer_group.position = {x, y};

  const dot = game.add.graphics(0, 0);
  dot.beginFill(0xFFFFFF);
  dot.drawCircle(0, 0, 10);
  dot.endFill();

  const nametag = game.add.text(0, 0 + 20, `${name}`, {fontSize: "12px", fill: "#FFFFFF"});
  nametag.anchor.setTo(0.5, 0.5);
  const location = game.add.text(0, 0 + 40, `${lat}, ${lon}`, {fontSize: "12px", fill: "#FFFFFF"});
  location.anchor.setTo(0.5, 0.5);

  const peer = new Peer(dot, nametag, location);

  peer_group.add(dot);
  peer_group.add(nametag);
  peer_group.add(location);
  return new Peer({dot: dot, nametag: nametag, location: location, group: peer_group});
}

/**
 * It'd be better if this just constructed a box object and didn't draw it
 */ 
function add_square(game, lat, lon, range) {
  const {x, y} = geo_to_screenspace(lat, lon);
  const lat_offset = range / LAT_MINUTES_MILES / MINUTES_PER_DEGREE * LAT_S;
  const lon_offset = range / LON_MINUTES_MILES / MINUTES_PER_DEGREE * LON_S;

  const box = game.add.graphics(0, 0);
  box.lineStyle(4, Peer.HIGHLIGHT_TINT, 1.0);
  box.drawRect(x - lat_offset, y - lon_offset, lat_offset * 2, lon_offset * 2);
  return box;
}

class Peer {
  static HIGHLIGHT_TINT = 0x80ff00;

  constructor({dot, nametag, location, group} = {}) {
    this.dot = dot;
    this.nametag = nametag;
    this.location = location;
    this.group = group;
  }

  highlight() {
    this.dot.tint = Peer.HIGHLIGHT_TINT;
    this.nametag.tint = Peer.HIGHLIGHT_TINT;
    this.location.tint = Peer.HIGHLIGHT_TINT;
  }

  dehighlight() {
    this.dot.tint = 0xFFFFFF;
    this.nametag.tint = 0xFFFFFF;
    this.location.tint = 0xFFFFFF;
  }
}