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
		RECORD: A4
	},
	TALLY: {
		PLAY: B9,
		STOP: B8,
		FAST_FORWARD: B7,
		REWIND: B6,
		RECORD: B0
	}
};
const WIFI_NAME = "OceanusStudio";
const WIFI_OPTIONS = { password : "studio125" };
const DEBUG = true;

const log = (msg) => {
	if(DEBUG) {
		console.log(msg);
	}
};


pinMode(
  PINS.TACH,
  'input_pullup'
);
pinMode(
  PINS.TACH_DIRECTION,
  'input_pullup'
);

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
const tachWatcher = (function(){
  var bin=atob("Akt7RAAiGmBwRwC/VgAAAAFLe0QYaHBHRgAAAAJLe0SA8AEAGHBwRzYAAAAHS3tEG3gjsQZKekQTaAEzA+AFSnpEE2gBOxNgcEcAvyYAAAAiAAAAGAAAAAE=");
  return {
    handlePulse:E.nativeCall(45, "void()", bin),
    getTach:E.nativeCall(17, "int()", bin),
    handleDirection:E.nativeCall(29, "void()", bin),
    reset:E.nativeCall(1, "void()", bin),
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

    perform(action) {
        if (this[action]) {
            this[action]();
            return true;
        } else {
            return false;
        }
    }
}

const CLOCK = new Clock(tachWatcher);

class Tally {
    get pins() {
        return {
            "play": PINS.TALLY.PLAY,
            "stop": PINS.TALLY.STOP,
            "record": PINS.TALLY.RECORD,
            "fast_forward": PINS.TALLY.FAST_FORWARD,
            "rewind": PINS.TALLY.REWIND
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
        Object.keys(this.pins).forEach((pinName) => {
            pinMode(this.pins[pinName], 'input_pullup');
        });
    }
}
const TALLY = new Tally();

class Transport {
    play() {
        this.pulse(PINS.TRANSPORT.PLAY);
    }

    stop() {
        this.pulse(PINS.TRANSPORT.STOP);
    }

    record() {
        this.pulse(PINS.TRANSPORT.RECORD);
    }

    rewind() {
        this.pulse(PINS.TRANSPORT.REWIND);
    }

    fastForward() {
        this.pulse(PINS.TRANSPORT.FAST_FORWARD);
    }

    perform(action) {
        action = action
            .replace("ff", "fastForward")
            .replace("rec", "record");

        if (this[action]) {
            log("performing action");
            this[action]();
            return true;
        } else {
            log("couldn't find action");
            return false;
        }
    }

    pulse(pin) {
        digitalWrite(pin, false);
        intervalId = setInterval(
            () => {
                digitalWrite(pin, true);
                clearInterval(intervalId);
            },
            50
        );
    }

    init() {
        const pins = [
            PINS.TRANSPORT.PLAY,
            PINS.TRANSPORT.STOP,
            PINS.TRANSPORT.RECORD,
            PINS.TRANSPORT.FAST_FORWARD,
            PINS.TRANSPORT.REWIND
        ];
        pins.forEach((pin) => {
            pinMode(pin, 'output');
            digitalWrite(pin, true);
        });
    }
}
const TRANSPORT = new Transport();

const getState = () => {
	return  {
		clock: {
			pulses: CLOCK.pulsesFromStart,
			seconds: CLOCK.seconds,
			time: CLOCK.time
		},
		tally: TALLY.state
	};
};


const attachInterupts = () => {
  setWatch(
	tachWatcher.handlePulse,
	PINS.TACH,
	{repeat:true, edge:"rising", irq:true}
  );

  setWatch(
	tachWatcher.handleDirection,
	PINS.TACH_DIRECTION,
	{repeat:true, edge:"both", irq:true}
  );

  if (DEBUG) {
	setInterval(
	  () => {
		log("STATE = " + JSON.stringify(getState()));
	  },
	  2000
	);
  }
};

const INDEX =`
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


const connectToWifi = () => {
	wifi.connect(WIFI_NAME, WIFI_OPTIONS, (err)  => {
		if (err) {
		  log("Connection error: " + err);
		  return;
		} else {
			log("Wifi Connected!");

			var info = {
					ip: "192.168.0.203",
					gw: "192.168.0.1",
					netmask: "255.255.255.0"
			};

			wifi.setIP(info, (err) => {
					log("IP set!");
					SERVER.init();
			});
		}
	});
};

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
            if (!TRANSPORT.perform(parsed.command)) {
                CLOCK.perform(parsed.command);
            }
        }
    }

    onSocketClose(socket) {
        log("onSocketClose");
        index = this.sockets.indexOf(socket);
        if (index > -1) {
            this.sockets.splice(index, 1);
        } else {
            log("couldn't find socket");
        }
    }

    get stateResponse() {
        return JSON.stringify(getState());
    }

    onSocketConnection(socket) {
        log("socket connection");
        this.sockets.push(socket);
        socket.send(this.stateResponse);
        socket.on("message", (message) => this.onSocketMessage(socket, message));
        socket.on("close", (event) => this.onSocketClose(socket));
    }

    onHttpRequest(request, response) {
        log("onHttpRequest");
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.end(INDEX);
    }

    init() {
        log("Server.init");
        ws
            .createServer((request, response) => this.onHttpRequest(request, response))
            .listen(80)
            .on("websocket", (socket) => this.onSocketConnection(socket));

        setInterval(
            () => this.broadcastState(),
            50
        );
    }
}
const SERVER = new Server();

var initialized = false;

function onInit() {
	connectToWifi();
	attachInterupts();
	TRANSPORT.init();
	TALLY.init();
	initialized = true;
}
if (!initialized) {
	onInit();
}
