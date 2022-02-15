"use strict";

const socket = io();

socket.on("traffic", (from, to) => {
  console.log("traffic!");
});