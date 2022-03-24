"use strict"

/**
 * TODO: map size, map center, and geo constants should be kept in a shared config with the server.
 * Our math is all based on lining up with OpenStreetMap imagery:
 * 
 * C_MILES = equatorial circumference of the earth defined by OSM, in miles
 * ZOOM_LEVEL = OSM zoom level at which we captured the background image
 * MAP_SIZE_MILES must match the map_size set in park.json
 * 
 * For more: https://wiki.openstreetmap.org/wiki/Zoom_levels
 */ 

const BORDER = 100;
const ANIMATION_BASE_DURATION = 5;
const SCREENSPACE_SIZE = 1000;
const SCREENSPACE_CENTER = SCREENSPACE_SIZE / 2;
const CANVAS_SIZE = SCREENSPACE_SIZE + BORDER * 2
const MAP_CENTER_LAT = 40.6816;
const MAP_CENTER_LON = -73.9349;
const LAT_MINUTES_MILES = 1.15;
const LON_MINUTES_MILES = 0.91;
const MINUTES_PER_DEGREE = 60;
const C_MILES = 24901.4608971109;
const ZOOM_LEVEL = 14;
const TILE_SIZE = C_MILES * Math.cos(MAP_CENTER_LAT) / Math.pow(2, ZOOM_LEVEL);
const MAP_SIZE_MILES = Math.abs(TILE_SIZE / 256) * SCREENSPACE_SIZE;
const LAT_BOUNDARY_OFFSET = MAP_SIZE_MILES / 2 / LAT_MINUTES_MILES / MINUTES_PER_DEGREE;
const LON_BOUNDARY_OFFSET = MAP_SIZE_MILES / 2 / LON_MINUTES_MILES / MINUTES_PER_DEGREE; 

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