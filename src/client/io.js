"use strict";

const HTTP_HOST = "localhost";
const HTTP_PORT = 9000;

const API = {
  STATE: "state"
};

const socket = io();

async function resource(endpoint) {
  const res = await fetch(`http://${HTTP_HOST}:${HTTP_PORT}/${endpoint}`);
  return await res.json();
}