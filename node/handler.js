//
// COLOR / WATCHDOG
//

const fs = require('fs');
// FIXME path should be more general
let config = JSON.parse(fs.readFileSync('/home/pi/xmas2022/node/config.json'));
console.log(config)

let lights = config["lights"];

let watchdogTimer;
let queue = [];

let afterColorTimeout = 1600;
let colorRecorder = [];
let colorRecorderTimer = null;

let resetCounter = 0;
let resetLimit = 3; // TODO Maybe 10?
let resetTime = 60000;

let colorActionTimer = null;
let colorActionTimeout = 1000;
let lastColorAction = "NONE";
let colorActions = ["BLUE", "RED", "GREEN"];

setInterval( function() {
  if (!watchdogTimer) {
    if (resetCounter < resetLimit ) {
      console.log("-");
      resetCounter++;
    } else {
      resetCounter = -99;
      console.log("---------------------------------------------------------------------");
      console.log("  PERIODICALLY RESET ALL");
      console.log("---------------------------------------------------------------------");
      sendMsg(["relay:set:DECOUPLERFRONT:OFF", "relay:set:DECOUPLERBACK:OFF", "relay:set:SIGNAL2:OFF", "relay:set:SIGNAL3:OFF", "relay:set:TRAINLED:WHITE", "relay:set:SWITCH:OFF"]);
    }
  } else {
    resetCounter = 0;
  }
}, resetTime);

/* FIXME randomly set WIP
setInterval( function() {
    toggle = lights.sort(() => Math.random() - 0.5)[0];
    sendMsg(["relay:toggle:"+toggle]);
}, 13*7*111);
*/

function sendWithFailsafe(msg) {
    sendMsg(msg);
    clearTimeout(watchdogTimer);
    watchdogTimer = setTimeout(function() {
      sendMsg(["relay:stop:TRAIN", "relay:set:TRAINLED:ORANGE", "relay:set:DECOUPLERFRONT:OFF", "relay:set:DECOUPLERBACK:OFF", "relay:set:SIGNAL2:OFF", "relay:set:SIGNAL3:OFF", "relay:toggle:SWITCH"]);
      watchdogTimer = null;
      queue = [];
      console.error("---------------------------------------------------------------------");
      console.error("FAILSAFE TRIGGERED, should not happen");
      console.error("---------------------------------------------------------------------");
    }, 10000);
}

function sendOrQueueSafe(msg) {
  if (!watchdogTimer) {
    sendWithFailsafe(msg);
  } else {
    queue.push(msg);
  }
}


function colorDetected(color, context) {
  if (context === "SWITCH") {
    colorTrainDetection(color);
  } else {
    colorTrainAction(color);
  }
}

function colorTrainDetection(color) {
    console.log(["SET WATCHDOG BASED ON color: ", color]);
    clearTimeout(watchdogTimer);
    watchdogTimer = setTimeout(function() {
      watchdogTimer = null;
      var msg = queue.shift();
      if (msg) {
        sendMsg(["relay:set:SIGNAL1:ON"]);
        sendWithFailsafe(msg);
      } else {
        sendMsg(["relay:stop:TRAIN", "relay:set:TRAINLED:WHITE"]);
      }
    }, afterColorTimeout);
    recordColor(color);
}

function recordColor(color) {
  colorRecorder.push(color);
  console.log("--");
  if (colorRecorderTimer == null) {
    console.log("---");
    colorRecorderTimer = setTimeout(function() {
      console.log("----");
      console.log(["relay:composition:TRAIN:", colorRecorder]);
      console.log("----");
      colorRecorderTimer = null;
      colorRecorder = [];
    }, 3000);
  }
  if (colorRecorder.length > 100) {
      queue = [];
      colorRecorder = [];
      clearTimeout(watchdogTimer);
      watchdogTimer = null;
      sendMsg(["relay:toggle:BLUE"]);
  }
}



function colorTrainAction(color) {
  if (colorActionTimer === null) {
    toggle = lights.sort(() => Math.random() - 0.5)[0];
    sendMsg(["relay:toggle:"+toggle]);
    target = lastColorAction;

    if (color === "BLUE") {
      target = "BLUE";
    } else if (color === "GREEN" || color === "YELLOW") {
      target = "GREEN";
    } else if (color === "RED" || color === "PURPLE") {
      target = "RED";
    }

    if (lastColorAction === target) {
      target = colorActions.sort(() => Math.random() - 0.5)[0];
    }

    sendMsg(["relay:toggle:"+target]);
    lastColorAction = target;
    colorActionTimer = setTimeout(function() {
        colorActionTimer = null
    }, colorActionTimeout)
  }
}


//
// BOUNDARY WEBSOCKET
//
var W3CWebSocket = require('websocket').w3cwebsocket;
var client = new W3CWebSocket('ws://localhost:8080/trainws/handler');

function receiveMsg(message) {
  cmd = message.split(":");
  console.log(" HANDLER Received: '" + message + "' " + cmd + " - " +  queue.length);

  if (cmd[0] === "color") {
    colorDetected(cmd[2], cmd[1]);
  }

  if (cmd[1] === "ALLLIGHTS") {
    lights.forEach(l => {sendMsg(["relay:"+cmd[0]+":"+l+":"+cmd[2]])})
  }

  if (queue.length < 20) {
    if (message === "toggle:BLUE" || message === "toggle:TRAIN") {
      sendOrQueueSafe(["relay:fastforward:TRAIN", "relay:set:TRAINLED:BLUE", "relay:set:SIGNAL1:OFF"]);
    }

    if (message === "toggle:GREEN" ) {
      sendOrQueueSafe(["relay:slowforward:TRAIN", "relay:set:TRAINLED:GREEN", "relay:set:SIGNAL1:OFF"]);
      sendOrQueueSafe(["relay:set:SWITCH:ON", "relay:set:WHITE1:OFF", "relay:toggle:DECOUPLERFRONT", "relay:toggle:SIGNAL2",  "relay:info:SIGNAL2", "relay:backward:TRAIN"]);
    }

    if (message === "toggle:RED" ) {
      sendOrQueueSafe(["relay:slowforward:TRAIN", "relay:set:TRAINLED:RED", "relay:set:SIGNAL1:OFF"]);
      sendOrQueueSafe(["relay:set:SWITCH:OFF", "relay:set:WHITE1:ON", "relay:toggle:DECOUPLERBACK", "relay:toggle:SIGNAL3",  "relay:backward:TRAIN"]);
    }
  }

  if (message === "info:BLUE" || message === "info:RED" || message === "info:GREEN") {
// FIXME train state move to decoupler?
    sendMsg(["state:"+cmd[1]+":ON"]);
  }

}

client.onerror = function() {
   console.log(Date.now() + 'Connection Error');
   process.exit(1);
};

client.onopen = function() {
    console.log(Date.now() + 'WebSocket Client Connected');
};

client.onclose = function() {
   console.log(Date.now() + 'WebSocket Client Closed');
   process.exit(1);
};

client.onmessage = function(e) {
    if (typeof e.data === 'string') {
        receiveMsg(e.data);
    }
};

function sendMsg(msgs) {
    if (client.readyState === client.OPEN) {
        msgs.forEach(msg => {client.send(msg)});
    }
}
