const fs = require('fs');
let config = JSON.parse(fs.readFileSync('/home/pi/xmas2022/node/config.json'));
console.log(config)

function TwoWayMap(map) {
   this.map = map;
   this.reverseMap = {};
   for(var key in map) {
      var value = map[key];
      this.reverseMap[value] = key;
   }
}

TwoWayMap.prototype.get = function(key){ return this.map[key]; };
TwoWayMap.prototype.revGet = function(key){ return this.reverseMap[key]; };

var itemMap = new TwoWayMap({
   'NIX01' : '0',
   'NIX02' : '1',
   'WHITE1' : '2',
   'WHITE1R' : '3',
   'WARN' : '4',
   'WARNR' : '5',
   'LIGHTHOUSE' : '6',
   'CAVE' : '7',
   'SIGNAL3' : '8',
   'SIGNAL3R' : '9',
   'SIGNAL2' : '10',
   'SIGNAL2R' : '11',
   'SIGNAL1' : '12',
   'SIGNAL1R' : '13',
   'NIX14' : '14',
   'NIX15' : '15',
   'SENSOR3' : '16'
});

var itemMap2 = new TwoWayMap({
   'UNUSED20' : '0',
   'UNUSED21' : '1',
   'HOUSE1' : '2',
   'HOUSE2' : '3',
   'TRACK' : '4',
   'HOUSE' : '5',
   'UNUSED26' : '6',
   'UNUSED27' : '7',
   'UNUSED28' : '8',
   'UNUSED29' : '9',
   'UNUSED210' : '10',
   'UNUSED211' : '11',
   'UNUSED212' : '12',
   'UNUSED213' : '13',
   'UNUSED214' : '14',
   'UNUSED215' : '15',
   'UNUSED216' : '16'
});

var status = {
   'MONSTER' : 0,
   'CAVE' : 0,
   'WARN' : 0,
   'LIGHTHOUSE' : 0,
   'SIGNAL1' : 0,
   'SIGNAL1R' : 0,
   'SIGNAL2' : 0,
   'SIGNAL2R' : 0,
   'SIGNAL3' : 0,
   'SIGNAL3R' : 0,
   'SENSOR1' : 0,
   'SENSOR2' : 0,
   'SENSOR3' : 0,
   'HOUSE' : 0,
   'TRACK' : 0,
   'WHITE1' : 0,
   'WHITE2' : 0,
   'WHITE1R' : 0,
   'WHITE2R' : 0,
   'TRAIN' : "WHITE"
};


var modes = {
   'MONSTERR' : 7,
   'MONSTER' : 5,
   'CAVE' : 5,
   'WARN' : 6,
   'WARNR' : 6,
   'LIGHTHOUSE' : 5,
   'SIGNAL1' : 7,
   'SIGNAL1R' : 7,
   'SIGNAL2' : 7,
   'SIGNAL2R' : 7,
   'SIGNAL3' : 7,
   'SIGNAL3R' : 7,
   'SENSOR1' : 0,
   'SENSOR2' : 0,
   'SENSOR3' : 0,
   'HOUSE' : 5,
   'TRACK' : 5,
   'HOUSE1' : 5,
   'HOUSE2' : 5,
   'WHITE1' : 7,
   'WHITE2' : 7,
};


var statusMap = new TwoWayMap( {
    "0" : "OFF", // MULTIPLE OFF
    "1" : "ON",  // REGULAR ON
    "2" : "A",   // SIGNAL ON
    "3" : "B",   // R
    "4" : "OFF", // FLICKER TO ON
    "5" : "ON",  // FLICKER TO OFF
    "6" : "ON",  // BLINK
    "7" : "ON",  // TOGGLE FLICKER
    "10" : "ON",  // BLINK ON
    "11" : "OFF",  // BLINK OFF
    "99" : "failed"
});

const I2C_TRAIN_ADDR = 0x0e;
const TRAIN_STARTFORWARD = 10;
const TRAIN_SLOWFORWARD = 11;
const TRAIN_FASTFORWARD = 12;
const TRAIN_BACKWARD = 20;
const TRAIN_STOP = 99;

let trainMode = TRAIN_STOP;

//
// BOUNDARY I2C
//

const i2c = require('i2c-bus');
const I2C_ADDR1 = 0x0b;
const I2C_ADDR2 = 0x0c;
const rbuffer = Buffer.alloc(16);
const rbuffer2 = Buffer.alloc(16);
const wbuffer = Buffer.alloc(16);
const wbuffer2 = Buffer.alloc(16);

const i2c1 = i2c.open(1, true, function (err) {
    if (err)  console.log(err);
});

lastread = 0;
readI2C = function() {
  if ( Date.now()-lastread > 1000) {
    lastread = Date.now();
    i2c1.i2cRead(I2C_ADDR1, 16, rbuffer, function (err,n) {
      if (err) { 
        console.log(err);
        for (i=0; i<16; i++) {
          rbuffer[i] = 99;
        }
      }
      console.log(rbuffer);
    });

    i2c1.i2cRead(I2C_ADDR2, 16, rbuffer2, function (err,n) {
      if (err) { 
        console.log(err);
        for (i=0; i<16; i++) {
          rbuffer2[i] = 99;
        }
      }
      console.log(rbuffer2);
    });

  }
}

sendI2C1 = function(addr,item) {
  wbuffer[0] = item;
  i2c1.i2cWriteSync(addr, 1, wbuffer);
}

sendI2C = function(addr,action,item1,item2,data) {
  console.debug(["send", addr, action, item1, item2, data]);
  wbuffer[0] = action;
  wbuffer[1] = item1;
  wbuffer[2] = item2;
  wbuffer[3] = data;
  i2c1.i2cWriteSync(addr, 4, wbuffer);
  console.debug(["done", addr, action, item1, item2, data]);
}

//
// BOUNDARY WEBSOCKET
//

var W3CWebSocket = require('websocket').w3cwebsocket;
var client = new W3CWebSocket('ws://localhost:8080/trainws/wire');

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

function receiveMsg(message) {
  cmd = message.split(":");
  itemName = cmd[1];

  if (cmd[1] === "TRAINLED" && cmd[0] === "set") {
    status["TRAIN"] = cmd[2];
  }

  if (status[itemName] != undefined) {

    console.log(Date.now() + " Received relevant meaasge: '" + message + "'");
    // console.debug(["item nos", cmd[0], itemName, m11, m12, m21, m22, item1Num, item2Num, modus]);

    m11 = itemMap.get(itemName);
    m12 = itemMap2.get(itemName);
    m21 = itemMap.get(itemName+"R");
    m22 = itemMap2.get(itemName+"R");

    let item1Num = m11 ? +m11 : ( m12 ? +m12 : 99)
    let item2Num = m21 ? +m21 : ( m22 ? +m22 : 99)

    let modus = modes[itemName];
    if (cmd[1] === "TRAIN" && cmd[0] != "toggle" && cmd[0] != "info") {
      if (message === 'fastforward:TRAIN') {
        trainMode = TRAIN_FASTFORWARD;
      } else if (message === 'startforward:TRAIN') {
        trainMode = TRAIN_STARTFORWARD;
      } else if (message === 'slowforward:TRAIN') {
        trainMode = TRAIN_SLOWFORWARD;
      } else if (message === 'backward:TRAIN') {
        trainMode = TRAIN_BACKWARD;
      } else if (message === 'stop:TRAIN') {
        trainMode = TRAIN_STOP;
      }
      console.log("SEND TRAINCOMMAND: ", trainMode);
      sendI2C1(I2C_TRAIN_ADDR, trainMode);
    }

    if (cmd[0] === "toggle" && item1Num != 99) {
      if (m11 && +m11 === item1Num) {
          sendI2C(I2C_ADDR1,modus,item1Num,item2Num,0);
      } else {
          sendI2C(I2C_ADDR2,modus,item1Num,item2Num,0);
      }
    }

    if (cmd[0] === "on" || (cmd[0] === "set" && cmd[2] === "ON")) {
      if (m11 && +m11 === item1Num) {
          sendI2C(I2C_ADDR1,1,item1Num,item2Num,0);
      } else {
          sendI2C(I2C_ADDR2,1,item1Num,item2Num,0);
      }
    }

    if (cmd[0] === "off" || (cmd[0] === "set" && cmd[2] === "OFF")) {
      if (m11 && +m11 === item1Num) {
          sendI2C(I2C_ADDR1,0,item1Num,item2Num,0);
      } else {
          sendI2C(I2C_ADDR2,0,item1Num,item2Num,0);
      }
    }

    if (cmd[0] === "info") {
      statusSync(false, cmd[1]);
    }
  }
}

// CONTROL

function healthCheck() {
    sendMsg(Date.now() + "alive");
}

statusSync = function(forceall, forceditem) {
  if (forceditem === "TRAIN") {
    sendMsg("state:TRAIN:"+status["TRAIN"]);
  } else {

  if (!forceditem || status[forceditem] != undefined) {
   readI2C();
   setTimeout( function() {
    for (i = 0; i<17; i++) {
      item = itemMap.revGet(i);
      sold = status[item];
      snew = rbuffer[i];
      if (forceall || sold!=snew || forceditem===item) {
          console.log(Date.now() + " SEND STATE: "  + item + ":" + statusMap.get(snew) + ":" + i + ":" + sold + ":" + snew);
          status[item] = snew;
          sendMsg("state:" + item + ":" + statusMap.get(snew));
      }

      item2 = itemMap2.revGet(i);
      sold2 = status[item2];
      snew2 = rbuffer2[i];
      if (forceall || sold2!=snew2 || forceditem===item2) {
          console.log(Date.now() + " SEND STATE: "  + item2 + ":" + statusMap.get(snew2) + ":" + i + ":" + sold2 + ":" + snew2);
          status[item2] = snew2;
          sendMsg("state:" + item2 + ":" + statusMap.get(snew2));
      }

    }
   }, 300);
  }
  }
}

console.log(Date.now() + " deley startupa bit to make sure everything is ready");

setInterval(() => {
  healthCheck();
}, 36000000);

// setInterval(() => {
//   statusSync();
// }, 1000);
