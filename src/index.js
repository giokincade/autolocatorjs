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
`);
**/
const tachWatcher = (function(){
  var bin=atob("AUt7RBhocEdGAAAAAkt7RIDwAQAYcHBHNgAAAAdLe0QbeCOxBkp6RBNoATMD4AVKekQTaAE7E2BwRwC/JgAAACIAAAAYAAAAAQ==");
  return {
    handlePulse:E.nativeCall(29, "void()", bin),
    getTach:E.nativeCall(1, "int()", bin),
    handleDirection:E.nativeCall(13, "void()", bin),
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
};
const CLOCK = new Clock(tachWatcher);

class Transport {
    play() {
        this.pulse(PINS.TRANSPORT.PLAY);
    }

    stop() {
        this.pulse(PINS.TRANSPORT.STOP);
    }

    rewind() {
        this.pulse(PINS.TRANSPORT.REWIND);
    }

    fastForward() {
        this.pulse(PINS.TRANSPORT.FAST_FORWARD);
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
        }
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
					ip: "192.168.0.201",
                    gw: "192.168.0.1",
                    netmask: "255.255.255.0"
			};

			wifi.setIP(info, (err) => {
					log("IP set!");
					startServer();
			});
		}
	});
};

const onSocketMessage = (socket, message) => {
    log("websocket message: " + message);
    socket.send("pong");
    /**
    parsed = JSON.parse(message);
    if (!message
            || !parsed
            || !parsed.command
            || parsed.command == 'state') {
        return JSON.stringify(getState());
    }
    **/
};

const onSocketConnection = (socket) => {
    log("socket connection");
    socket.send(JSON.stringify(getState()));
    socket.on("message", (message) => {
        log("socket message");
        log(message);
    });
    socket.on("close", () => {
        log("socket close");
    });
};

const onHttpRequest = (request, response) => {
	log("processing http request");
	response.writeHead(200, { 'Content-Type': 'text/html' });
	response.end(INDEX);
};

const startServer = () => {
	log("Starting Server");
	ws
		.createServer(onHttpRequest)
		.listen(80)
		.on("websocket", onSocketConnection);
};

var initialized = false;
function onInit() {
    connectToWifi();
    attachInterupts();
    TRANSPORT.init();
    initialized = true;
}
if (!initialized) {
    onInit();
}
