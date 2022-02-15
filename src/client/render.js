"use strict"

// TODO: map size, map center, and geo constants should be kept in a common config
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
  return {x: SCREENSPACE_CENTER + lat_px_offset, y: SCREENSPACE_CENTER + lon_px_offset};
}

function draw_peer(game, name, lat, lon) {
  const lat_px_offset = (MAP_CENTER_LAT - lat) * LAT_S;
  const lon_px_offset = (MAP_CENTER_LON - lon) * LON_S;
  const {x, y} = geo_to_screenspace(lat, lon);

  const peer = game.add.graphics(0, 0);
  peer.beginFill(0xFFFFFF);
  peer.drawCircle(x, y, 10);
  peer.endFill();

  const nametag = game.add.text(x, y + 24, name, {fontSize: "16px", fill: "#FFFFFF"});
  nametag.anchor.setTo(0.5, 0.5);
}