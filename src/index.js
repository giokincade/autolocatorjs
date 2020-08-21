const wifi = require("Wifi");
const ws = require("ws");
const http = require("http");

const PINS = {
  TACH: A0,
  TACH_DIRECTION: A1,
  TRANSPORT: {
    PLAY: A5,
    STOP: A6,
    FAST_FORWARD: A7,
    REWIND: B1,
    RECORD: A4,
  },
  TALLY: {
    PLAY: B9,
    STOP: B8,
    FAST_FORWARD: B7,
    REWIND: B6,
    RECORD: B0,
  },
};

const MATT_CONFIG = {
    "debug": true,
    "wifi":  {
      name:  "OceanusStudio",
      password: "studio125"
    },
    "network": {
        ip: "192.168.0.203",
        gw: "192.168.0.1",
        netmask: "255.255.255.0",
    }
};

const GIO_CONFIG = {
  "debug": true,
  "wifi":  {
    name:  "network_name",
    password: "pw"
  }
};
const CONFIG = MATT_CONFIG;

const log = (msg) => {
  if (CONFIG.debug) {
    console.log(msg);
  }
};

var stopLocating = 0;
var locatorInterval = 250; //in ms
var lastLocatorTime = 0;
var isLocating = 0;

pinMode(PINS.TACH, "input_pullup");
pinMode(PINS.TACH_DIRECTION, "input_pullup");

/**
const tachWatcher = E.compiledC(`
//void handlePulse()
//int getTach()
//void handleDirection()
//void reset()

volatile int pulsesFromStart = 0;
volatile bool isDirectionForward = true;

void handlePulse() {
	if (isDirectionForward) {
		pulsesFromStart++;
	} else {
		pulsesFromStart--;
	}
}

void handleDirection(bool state) {
  isDirectionForward = !state;
}


int getTach() {
	return pulsesFromStart;
}

void reset() {
	pulsesFromStart = 0;
}
`);
**/
// Code saved with E.setBootCode
const tachWatcher = (function () {
  var bin = atob(
    "Akt7RAAiGmBwRwC/VgAAAAFLe0QYaHBHRgAAAAJLe0SA8AEAGHBwRzYAAAAHS3tEG3gjsQZKekQTaAEzA+AFSnpEE2gBOxNgcEcAvyYAAAAiAAAAGAAAAAE="
  );
  return {
    handlePulse: E.nativeCall(45, "void()", bin),
    getTach: E.nativeCall(17, "int()", bin),
    handleDirection: E.nativeCall(29, "void()", bin),
    reset: E.nativeCall(1, "void()", bin),
  };
})();

class Clock {
  constructor(tachWatcher, rotationsPerSecond) {
    this.tachWatcher = tachWatcher;
    this.rotationsPerSecond = rotationsPerSecond || 4800;
  }

  get pulsesFromStart() {
    return this.tachWatcher.getTach();
  }

  get seconds() {
    return this.tachWatcher.getTach() / 4800.0;
  }

  get time() {
    const minutes = Math.floor(this.seconds / 60);
    const seconds = this.seconds - minutes * 60.0;
    return minutes + ":" + seconds;
  }

  reset() {
    log("reset");
    this.tachWatcher.reset();
  }

  perform(action, value) {
    if (this[action]) {
      this[action]();
      return true;
    } else {
      return false;
    }
  }

  init() {
    log("Clock.init");
    //TODO update these to point to this.tachWatcher
    setWatch(tachWatcher.handlePulse, PINS.TACH, {
      repeat: true,
      edge: "rising",
      irq: true,
    });

    //TODO update these to point to this.tachWatcher
    setWatch(tachWatcher.handleDirection, PINS.TACH_DIRECTION, {
      repeat: true,
      edge: "both",
      irq: true,
    });

    return Promise.resolve();
  }
}
const CLOCK = new Clock(tachWatcher);

class Tally {
  get pins() {
    return {
      play: PINS.TALLY.PLAY,
      stop: PINS.TALLY.STOP,
      record: PINS.TALLY.RECORD,
      fast_forward: PINS.TALLY.FAST_FORWARD,
      rewind: PINS.TALLY.REWIND,
    };
  }

  get state() {
    var result = {};

    Object.keys(this.pins).forEach((pinName) => {
      result[pinName] = this.isLit(pinName);
    });

    return result;
  }

  isLit(pinName) {
    if (digitalRead(this.pins[pinName]) == 0) {
      return 1;
    } else {
      return 0;
    }
  }

  init() {
    log("Tally.init");
    Object.keys(this.pins).forEach((pinName) => {
      pinMode(this.pins[pinName], "input_pullup");
    });

    return Promise.resolve();
  }
}
const TALLY = new Tally();

class Transport {
  play() {
    this.pulse(PINS.TRANSPORT.PLAY);
  }

  stop() {
    this.pulse(PINS.TRANSPORT.STOP);
    stopLocating = 1;
  }

  record() {
    log("IS RECORDING: " + TALLY.state.record);
    log("IS PLAYING: " + TALLY.state.play);

    if (TALLY.state.record) {
      log("PRESS PLAY");
      this.play();
      return;
    } else if (TALLY.state.play) {
      log("ENABLE RECORD");
      this.pulse(PINS.TRANSPORT.RECORD);
      return;
    } else {
      log("PLAY AND RECORD");
      this.play();
      //digitalWrite(PINS.TRANSPORT.RECORD, true);
      setTimeout(() => {
        this.record();
      }, 100);
      return;
    }

    /**
		const pin = PINS.TRANSPORT.RECORD;
		if (value) {
			log("record low");
			digitalWrite(pin, false);
		} else {
			log("record hi");
			digitalWrite(pin, true);
		}
		**/
  }

  rewind() {
    log(" << rewind");
    //digitalWrite(pin, false);
    this.pulse(PINS.TRANSPORT.REWIND);
  }

  fastForward() {
    log(" << ff");
    this.pulse(PINS.TRANSPORT.FAST_FORWARD);
  }

  perform(action, value) {
    log("transportPerform");
    log(action);
    log(value);
    action = action.replace("ff", "fastForward").replace("rec", "record");

    if (this[action]) {
      log("performing action");
      this[action](value);
      return true;
    } else {
      log("couldn't find action");
      return false;
    }
  }

  pulse(pin) {
    log("pulsing");
    log(pin);
    digitalWrite(pin, false);
    intervalId = setInterval(
      () => {
        digitalWrite(pin, true);
        clearInterval(intervalId);
      },
      80 //PUSH INTERVAL
    );
  }

  init() {
    log("Transport.init");
    const pins = [
      PINS.TRANSPORT.PLAY,
      PINS.TRANSPORT.STOP,
      PINS.TRANSPORT.RECORD,
      PINS.TRANSPORT.FAST_FORWARD,
      PINS.TRANSPORT.REWIND,
    ];
    pins.forEach((pin) => {
      pinMode(pin, "output");
      digitalWrite(pin, true);
    });

    return Promise.resolve();
  }
}

const TRANSPORT = new Transport();

class Locate {
	/*
	doToggle(dutyCycle, toggleInterval)
	{
		this.dutyCycle = dutyCycle;
		this.toggleInterval = toggleInterval;

		var forward = true;

		if(dutyCycle < .5)
		{
			forward = false;
		}
		
      this.toggleSet(forward);

      setInterval(() => this.toggleSet(forward), this.toggleInterval);

	}

	toggleSet(forward)
	{
      var timestamp = new Date() / 1000;
      
		if(forward)
		{
			log(timestamp + " :: FF !!! ");
			digitalWrite(PINS.TRANSPORT.REWIND, true);
			digitalWrite(PINS.TRANSPORT.FAST_FORWARD, false); //remember low (false) is on 
			//TRANSPORT.fastForward();
		} else {
			log(timestamp + " :: REWIND !!! ");
			digitalWrite(PINS.TRANSPORT.REWIND, false);
			digitalWrite(PINS.TRANSPORT.FAST_FORWARD, true);
			//TRANSPORT.rewind();
		} 
      
		if(forward)
		{
			var timeToReverse = this.toggleInterval*(this.dutyCycle);

			setTimeout(() => {
				this.toggleSet(!forward);
			}, timeToReverse);
		} 
	}

	//LOCATE.doToggle(.6, 5000)
	*/

  toTime(time) {
    log("STOP LOCATING: " + stopLocating);
    log("IS LOCATING: " + isLocating);

    if (stopLocating) {
      stopLocating = 0;
      isLocating = 0;
      return;
    }

    var fastMinDiff = 40;
    var topSpeed = 0.08 * locatorInterval;

    var counter = CLOCK.seconds;
    log("\n\nLOCATE TIME: " + time);
    log("COUNTER: " + counter);

    var diff = Math.abs(time - counter);

    //bullshit hack for now dont ask
    if(time > counter)
    {
    	diff = diff - .5;
    } else {
    	diff = diff + .5;
    }

    var speed = Math.abs(
      (lastLocatorTime - counter) / (locatorInterval / 1000)
    );

    log("DIFF: " + diff);
    log("SPEED : " + speed);

    if (diff < 1) {
      isLocating = 0;
      TRANSPORT.stop();
      stopLocating = 0;
      isLocating = 0;
      return;
    }

    var direction = "rewind";

    if (time > counter) {
      direction = "fast_forward";
    }

    if (diff < 45 && isLocating) {
      //we're moving and close
      log("DIFF CLOSE!!!!!!!!!!!!!!!!!!!!!");

      var idealSpeed = Math.abs(diff * (topSpeed / fastMinDiff));
      //var idealSpeed = Math.abs((diff*diff*topSpeed)/Math.sqrt(fastMinDiff));
      log("IDEAL SPEED: " + idealSpeed);

      if (speed > idealSpeed) {
        //too fast
        if (direction == "rewind") {
          TRANSPORT.fastForward(); //opposite of rewind
        } else {
          //direction is ff so rewind
          TRANSPORT.rewind();
        }
      } else {
        //too slow
        if (direction == "rewind") {
          TRANSPORT.rewind();
        } else {
          TRANSPORT.fastForward();
        }
      }
    }

    if (!isLocating) {
      isLocating = 1;
      log("INITIAL DIRECTION : " + direction);

      if (direction == "fast_forward") {
        if (!TALLY.state.fast_forward) {
          TRANSPORT.fastForward();
        }
      } else {
        if (!TALLY.state.rewind) {
          TRANSPORT.rewind();
        }
      }
    }

    lastLocatorTime = counter;

    if (!isLocating) {
      return;
    }

    setTimeout(() => {
      this.toTime(time);
    }, locatorInterval);
  }
}

const LOCATE = new Locate();

const attachInterupts = () => {

};

const INDEX = `
<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8"/>
		<meta name="viewport" content="width=device-width,initial-scale=1"/>
		<meta name="theme-color" content="#000000"/>
		<meta name="description" content="Autolocator Interface"/>
		<title>Autolocator</title>
	</head>
	<body>
		<noscript>You need to enable JavaScript to run this app.</noscript>
		<div id="root"></div>
		<script src="http://autolocator.oceanus.nyc/autolocator-build.js"></script>
	</body>
</html>
`;

class Network {
  init() {
    return new Promise((resolve, reject) => {
      wifi.connect(CONFIG.wifi.name, CONFIG.wifi, (err) => {
        if (err) {
          log("Connection error: " + err);
          reject();
        } else {
          log("Wifi Connected!");

          if (CONFIG.network) {
              wifi.setIP(CONFIG.network, (err) => {
                if (err) {
                  log("IP Setting Error " + err);
                  reject();
                } else {
                  log("IP set!");
                  log(CONFIG.network);
                  resolve();
                }
              });
          } else {
              wifi.getIP((err, ipinfo) => {
                if (err) {
                  log("getIP Error: " + err);
                  reject();
                } else {
                  log(ipinfo);
                  resolve();
                }
              });
          }
        }
      });
    })
  }
}
const NETWORK = new Network();

//Beware: There are arrow functions everywhere to ensure that the `this` pointer is correct.
class Server {
  constructor() {
    this.sockets = [];
  }

  broadcastState() {
    this.sockets.forEach((socket) => {
      if (socket && socket.connected) {
        socket.send(this.stateResponse);
      }
    });
  }

  onSocketMessage(socket, message) {
    log("socket message");
    log(message);
    parsed = JSON.parse(message);
    if (parsed && parsed.command) {
      if (!TRANSPORT.perform(parsed.command, parsed.value)) {
        CLOCK.perform(parsed.command, parsed.value);
      }
    }
  }

  onSocketClose(socket) {
    log(
      "\n\n\n ************************* SOCKET CLOSE WTF?!?!?!?!?! *********************\n\n\n"
    );
    index = this.sockets.indexOf(socket);
    if (index > -1) {
      log("found socket");
      this.sockets.splice(index, 1);
    } else {
      log("couldn't find socket");
    }
  }

  get state() {
    return {
      clock: {
        pulses: CLOCK.pulsesFromStart,
        seconds: CLOCK.seconds,
        time: CLOCK.time,
      },
      tally: TALLY.state,
    };
  }


  get stateResponse() {
    return JSON.stringify(this.state);
  }

  onSocketConnection(socket) {
    log("socket connection");
    //We're throwing out all the old sockets because Matt hates life.
    //NO I DONT
    this.sockets = [socket];
    socket.send(this.stateResponse);
    socket.on("message", (message) => this.onSocketMessage(socket, message));
    socket.on("close", (event) => this.onSocketClose(socket));
  }

  onHttpRequest(request, response) {
    log("onHttpRequest");
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end(INDEX);
  }

  init() {
    log("Server.init");
    ws.createServer((request, response) =>
      this.onHttpRequest(request, response)
    )
      .listen(80)
      .on("websocket", (socket) => this.onSocketConnection(socket));

    setInterval(() => this.broadcastState(), 50);
    const self = this;
    if (CONFIG.debug) {
      setInterval(() => {
        log("STATE = " + self.stateResponse);
      }, 10000);
    }
  }
}
const SERVER = new Server();


class StatusIndicator {
  good() {
    LED2.write(true);
  }

  bad() {
    var on = false;
    setInterval(() => {
      on = !on;
      LED1.write(on);
    }, 500);
  }
}
const STATUS = new StatusIndicator();

var initialized = false;
function onInit() {
  if (!initialized) {
    initialized = true;
    NETWORK.init()
      .then(() => CLOCK.init())
      .then(() => TRANSPORT.init())
      .then(() => TALLY.init())
      .then(() => SERVER.init())
      .then(() => STATUS.good())
      .catch(() => STATUS.bad());
  }
}

if (onInit) {
  onInit()
}
