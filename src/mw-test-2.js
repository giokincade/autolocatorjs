const wifi = require("Wifi");
const ws = require("ws");

const PINS = {
    TACH: A0,
    TACH_DIRECTION: A1,
    PLAY: A4
};
const WIFI_NAME = "OceanusStudio";
const WIFI_OPTIONS = { password : "studio125" };


pinMode(
  PINS.TACH,
  'input_pullup'
);
pinMode(
  PINS.TACH_DIRECTION,
  'input_pullup'
);

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

const getTime = () => {
  const secondsRaw = tachWatcher.getTach() / 4800.0;
  const minutes = Math.floor(secondsRaw / 60);
  const seconds = secondsRaw - minutes * 60.0;
  return minutes + ":" + seconds;
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
};

setInterval(
    () => {
        log("Tach = " + tachWatcher.getTach());
        log("Time = " + getTime());
    },
    1000
);
const connectToWifi = () => {
	wifi.connect(WIFI_NAME, WIFI_OPTIONS, (err)  => {
		if (err) {
		  log("Connection error: " + err);
		  return;
		} else {
			log("Wifi Connected!");

			var info = {
					ip: "192.168.0.159",
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
		.on("websocket", (socket) => {
			log("websocket connection");
			socket.on("message", (msg) => {
				log("websocket message: " + msg);
				socket.send("pong");
			});
		});

};

function log(msg) {
	if(debug)
	{
		console.log(msg);
	}
}

function onInit() {
	connectToWifi();
    attachInterupts();
}

var debug = true;
