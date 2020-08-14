const wifi = require("Wifi");
const ws = require("ws");
const http = require("http");

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
    }

    stop() {
    }

    rewind() {
    }

    fastforward() {
    }
}

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

const getIndexPage = (responseStream) => {
    http.get('http://autolocator.oceanus.nyc/index.html', (cloudResponse) => {
        var contents = "";
        cloudResponse.on("data", (data) => {
            contents += data;
        });
        cloudResponse.on("close", () => {
            responseStream.end(contents);
        });
    });
};



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
    parsed = JSON.parse(message);
    if (!message
            || !parsed
            || !parsed.command
            || parsed.command == 'state') {
        return JSON.stringify(getState());
    }
};

const onSocketConnection = (socket) => {
    log("socket connection");
    socket.on("message", (message) => onSocketMessage(socket, message));
};

const onHttpRequest = (request, response) => {
	log("processing http request");
	response.writeHead(200, { 'Content-Type': 'text/html' });
	getIndexPage(response);
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
    initialized = true;
}
if (!initialized) {
    onInit();
}
