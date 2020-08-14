const wifi = require("Wifi");
const ws = require("ws");

const PINS = {
    TACH: A0,
    TACH_DIRECTION: A1,
    PLAY: A4
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
    constructor(tachWatcher, rotationsPerSecond = 4800.0) {
        this.tachWatcher = tachWatcher;
        this.rotationsPerSecond = 4800;
    }

    get seconds() {
        return this.tachWatcher.getTach() / 4800.0;
    }

    get time() {
      const minutes = Math.floor(secondsRaw / 60);
      const seconds = secondsRaw - minutes * 60.0;
      return minutes + ":" + seconds;
    }
};
const CLOCK = Clock(tachWatcher);

const getState = () => {
    return  {
        clock: {
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
        log("Tach = " + tachWatcher.getTach());
        log("Time = " + CLOCK.time);
      },
      1000
    );
  }
};

const connectToWifi = () => {
	wifi.connect(WIFI_NAME, WIFI_OPTIONS, (err)  => {
		if (err) {
		  log("Connection error: " + err);
		  return;
		} else {
			log("Wifi Connected!");

			var info = {
					ip: "192.168.1.200",
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

const onSocketMessage = (socket) => (message) => {
    log("websocket message: " + message);
    parsed = JSON.parse(message);
    if (!message
            || !parsed
            || !parsed.command
            || parsed.command = 'state') {
        return JSON.stringify(getState());
    }
};

const onSocketConnection = (socket) => {
    log("socket connection");
    socket.on("message", onSocketMessage(socket))
};

const onHttpRequest = (request, response) => {
	log("Processing request");
	response.writeHead(200, { 'Content-Type': 'text/html' });
	response.end(getTime());
};

const startServer = () => {
	log("Starting Server");
	ws
		.createServer(onHttpRequest)
		.listen(80)
		.on("websocket", onSocketConnection);
};

function onInit() {
	connectToWifi();
    attachInterupts();
}

