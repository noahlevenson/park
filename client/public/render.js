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

function add_peer(game, name, lat, lon) {
  const {x, y} = geo_to_screenspace(lat, lon);

  const peer_group = game.add.group();
  peer_group.position = {x, y};

  const peer = game.add.graphics(0, 0);
  peer.beginFill(0xFFFFFF);
  peer.drawCircle(0, 0, 10);
  peer.endFill();

  const nametag = game.add.text(0, 0 + 20, `${name}`, {fontSize: "12px", fill: "#FFFFFF"});
  nametag.anchor.setTo(0.5, 0.5);
  const location = game.add.text(0, 0 + 40, `${lat}, ${lon}`, {fontSize: "12px", fill: "#FFFFFF"});
  location.anchor.setTo(0.5, 0.5);

  peer_group.add(peer);
  peer_group.add(nametag);
  peer_group.add(location);
  return peer_group;
}

function add_square(game, lat, lon, range) {
  const {x, y} = geo_to_screenspace(lat, lon);
  const lat_offset = range / LAT_MINUTES_MILES / MINUTES_PER_DEGREE * LAT_S;
  const lon_offset = range / LON_MINUTES_MILES / MINUTES_PER_DEGREE * LON_S;

  const box = game.add.graphics(0, 0);
  box.lineStyle(4, 0x80ff00, 1.0);
  box.drawRect(x - lat_offset, y - lon_offset, lat_offset * 2, lon_offset * 2);
  return box;
}