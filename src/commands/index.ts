import * as ping from "./ping.js";
import * as play from "./play.js";
import * as skip from "./skip.js";
import * as stop from "./stop.js";
import * as listen from "./listen.js";
import * as stoplisten from "./stoplisten.js";

// Every command module exports `data` (the definition) and `execute` (the handler).
// To add a new command: create the file, then add it to this array. That's it.
export const commands = [ping, play, skip, stop, listen, stoplisten];
