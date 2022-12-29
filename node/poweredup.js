const fs = require('fs');
// FIXME path should be more general
let config = JSON.parse(fs.readFileSync('/home/pi/xmas2022/node/config.json'));
console.log(config)

//
// BOUNDARY Powered UP
//

const PoweredUP = require("node-poweredup");
const poweredUP = new PoweredUP.PoweredUP();
poweredUP.scan(); // Start scanning

console.log("Looking for train and remote...");

let remoteHub = null;
let remoteButtonLeft = null;
let remoteButtonRight = null;
let remoteLed = null;

// START WIP
let hubConfigs = {
  "remote1": {
    "LEFT" : {
      "type": "REMOTE",
      "UP": "relay:toggle:GREEN",
      "DOWN": "relay:toggle:BLUE",
      "STOP": "relay:toggle:RED",
    },
    "RIGHT" : {
      "type": "REMOTE",
      "UP": "relay:toggle:MODEYF",
      "DOWN": "relay:backward:MODEYP",
      "STOP": "relay:toggle:TRAINB",
    },
  }
};
// END WIP

let motorConfig = {
"SWITCH" : {
  motor: null,
  state: "OFF",
  degrees: 110,
  speed: 100,
  led: null,
},
"DECOUPLERBACK" : {
  motor: null,
  state: "OFF",
  degrees: 140,
  speed: -5,
  led: null,
},
"DECOUPLERFRONT" : {
  motor: null,
  state: "OFF",
  degrees: 140,
  speed: 5,
  led: null,
}
}

poweredUP.on("discover", async (hub) => {

    console.log("discovered: " + hub.type);

    await hub.connect().catch(e => {console.warn([e, new Date().toISOString() + " bt connect issue"])});
    console.log("INFO connect " + hub.primaryMACAddress);

    if (hub.type === PoweredUP.Consts.HubType.HUB) {

        hub.disconnect();

    } else if (hub.type === PoweredUP.Consts.HubType.REMOTE_CONTROL) {

        if (hub.primaryMACAddress == config["hubAddr"]["remote1"] ) {
          remoteHub = hub;
          const led = await remoteHub.waitForDeviceByType(PoweredUP.Consts.DeviceType.HUB_LED);

          remoteButtonLeft = await remoteHub.waitForDeviceAtPort("LEFT");
          remoteButtonRight = await remoteHub.waitForDeviceAtPort("RIGHT");
          led.setColor(PoweredUP.Consts.Color.PURPLE);

          addr = "remote1";

          remoteButtonLeft.on("remoteButton", ({ event }) => {
                if (event === PoweredUP.Consts.ButtonState.UP) {
                  sendMsg(hubConfigs[addr]["LEFT"]["UP"]);
                } else if (event === PoweredUP.Consts.ButtonState.STOP) {
                  sendMsg(hubConfigs[addr]["LEFT"]["STOP"]);
                } else if (event === PoweredUP.Consts.ButtonState.DOWN) {
                  sendMsg(hubConfigs[addr]["LEFT"]["DOWN"]);
                }
          });

          remoteButtonRight.on("remoteButton", ({ event }) => {
                if (event === PoweredUP.Consts.ButtonState.UP) {
                  sendMsg("relay:startforward:TRAIN");
                } else if (event === PoweredUP.Consts.ButtonState.STOP) {
                  sendMsg("relay:stop:TRAIN");
                } else if (event === PoweredUP.Consts.ButtonState.DOWN) {
                  sendMsg("relay:backward:TRAIN");
                }
          });
          console.log(`INFO: Connected to remote (${remoteHub.name})!`);

        } else if (hub.primaryMACAddress == config["hubAddr"]["remote2"]) {

          console.log("UNKONW remote2 " + hub.primaryMACAddress);
          hub.disconnect();

        } else {
          console.log("UNKONW remote " + hub.primaryMACAddress);
          hub.disconnect();
        }

    } else if (hub.type === PoweredUP.Consts.HubType.MOVE_HUB) {

        console.log(`INFO: Connected to moveHub (${hub.name} / hub.primaryMACAddress))!`);

        if (hub.primaryMACAddress == config["hubAddr"]["SWITCH"]) {

          motorConfig["SWITCH"].motor = await hub.waitForDeviceAtPort("C");
          motorConfig["SWITCH"].led = await hub.waitForDeviceByType(PoweredUP.Consts.DeviceType.HUB_LED);
          motorConfig["SWITCH"].led.setColor(PoweredUP.Consts.Color.WHITE);

          hub.on("color", (device, { color }) => {
            if (color && color !=0) {
              motorConfig["SWITCH"].led.setColor(color);
            }
            colorSensorHandler(device, color, "SWITCH");
          });

          hub.on("button", (device) => {
            console.log("button pressed");
            buttonHandler(device, "SWITCH");
          });

        } else if (hub.primaryMACAddress == config["hubAddr"]["DECOUPLER"]) {


          motorConfig["DECOUPLERFRONT"].motor = await hub.waitForDeviceAtPort("A");

          motorConfig["DECOUPLERBACK"].led = await hub.waitForDeviceByType(PoweredUP.Consts.DeviceType.HUB_LED);
          motorConfig["DECOUPLERBACK"].led.setColor(PoweredUP.Consts.Color.WHITE);
          motorConfig["DECOUPLERBACK"].motor = await hub.waitForDeviceAtPort("C");

          hub.on("colorAndDistance", (device, { color, distance}) => {
            console.log("detected movement with distance: "+distance);
            colorSensorHandler(device, color, "DECOUPLER");
          });

          hub.on("distance", (device, { distance}) => {
            console.log("detected movement with distand: "+distance);
            colorSensorHandler(device, PoweredUP.Consts.Color.BLUE, "DECOUPLER");
          });

          hub.on("button", (device) => {
            buttonHandler(device,"DECOUPLER");
          });
        }

        hub.on("disconnect", () => {
          console.log("disconnect move hub");
        });
    } else {
          console.log("UNKONW hub " + hub.primaryMACAddress);
          hub.disconnect();
    }
});


//
// PoweredUp Actions
//

async function setMotor(config, goal) {
  if (!config.motor) { console.log("WARN: motor missing"); return; }
  if (config.state != goal) {
    return await toggleMotor(config);
  }
  return;
}

async function toggleMotor(config) {
  if (!config.motor) { console.log("WARN: motor missing"); return; }
  let dir = config.speed;
  if (config.state == "OFF") {
    config.state = "ON";
  } else {
    config.state = "OFF";
    dir = -dir;
  }
  console.log("set motor to: " + [config.state, config.speed, dir])
  return await config.motor.rotateByDegrees(config.degrees, dir)
      .catch(e => {console.warn([e, new Date().toISOString() + " motor to far", config])});
}

function buttonHandler(device, context) {
// FIXME
//  sendMsg("relay:toggle:"+context);
}

function colorSensorHandler(device, color, context) {
  if (color && color != 0) {
    sendMsg("relay:color:"+context+":"+PoweredUP.Consts.Color[color]);
  }
}

//
// BOUNDARY WEBSOCKET
//
var W3CWebSocket = require('websocket').w3cwebsocket;
var client = new W3CWebSocket('ws://localhost:8080/trainws/poweredup');

function receiveMsg(message) {
  cmd = message.split(":");

  if (message === "toggle:SWITCH" ) {
    toggleMotor(motorConfig["SWITCH"]);
  }

  if (message === "toggle:DECOUPLERBACK" ) {
    toggleMotor(motorConfig["DECOUPLERBACK"]);
  }

  if (message === "toggle:DECOUPLERFRONT" ) {
    toggleMotor(motorConfig["DECOUPLERFRONT"]);
  }

  if (cmd[0] === "set") {
     state = cmd[2];
     if (cmd[1] === "SWITCH") {
        setMotor( motorConfig[cmd[1]], state);
     } else if (cmd[1] === "DECOUPLERBACK") {
        setMotor(motorConfig["DECOUPLERBACK"], state);
     } else if (cmd[1] === "DECOUPLERFRONT") {
        setMotor(motorConfig["DECOUPLERFRONT"], state);
     } else if (cmd[1] === "TRAINLED") {
        motorConfig["DECOUPLERBACK"].led?.setColor(PoweredUP.Consts.Color[state]);
     }
  }

  if (motorConfig["SWITCH"].led) motorConfig["SWITCH"].led.setColor( (motorConfig["SWITCH"].state == "ON") ? PoweredUP.Consts.Color.GREEN : PoweredUP.Consts.Color.RED);

  if (cmd[0] === "info") {
    config = motorConfig[cmd[1]]
    if (config) {
      sendMsg("state:"+cmd[1]+":"+config.state);
    }
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

function sendMsg(msg) {
    if (client.readyState === client.OPEN) {
        client.send(msg);
    }
}
