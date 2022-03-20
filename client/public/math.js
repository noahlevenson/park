"use strict"

// TODO: map size, map center, and geo constants should be kept in a shared config with the server
const BORDER = 100;
const ANIMATION_BASE_DURATION = 5;
const SCREENSPACE_SIZE = 1000;
const SCREENSPACE_CENTER = SCREENSPACE_SIZE / 2;
const CANVAS_SIZE = SCREENSPACE_SIZE + BORDER * 2
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

/**
 * These functions which transform between screenspace and geographic space return accurate values
 * because they sneakily factor in the BORDER region which we add to the game canvas. Thus, if you 
 * try to compute screensapce coords or geographic coords without using these functions, you may 
 * find yourself having a bad time.
 */ 

function geo_to_screenspace(lat, lon) {
  const lat_px_offset = (MAP_CENTER_LAT - lat) * LAT_S;
  const lon_px_offset = (MAP_CENTER_LON - lon) * LON_S;
  
  return {
    x: SCREENSPACE_CENTER + lat_px_offset + BORDER, 
    y: SCREENSPACE_CENTER + lon_px_offset + BORDER
  };
}

function screenspace_to_geo(x, y) { 
  const lat_offset = (SCREENSPACE_CENTER - x + BORDER) / LAT_S;
  const lon_offset = (SCREENSPACE_CENTER - y + BORDER) / LON_S;
  return {lat: MAP_CENTER_LAT + lat_offset, lon: MAP_CENTER_LON + lon_offset};  
}