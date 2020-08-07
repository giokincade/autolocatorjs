const wifi = require("Wifi");
const ws = require("ws");

const WIFI_NAME = "OceanusStudio";
const WIFI_OPTIONS = { password : "studio125" };

const connectToWifi = () => {
	wifi.reset();

	wifi.connect(WIFI_NAME, WIFI_OPTIONS, (err)  => {
		if (err) {
		  console.log("Connection error: " + err);
		  return;
		} else {
			console.log("Wifi Connected!");

			var info = {
					ip: "192.168.0.159",
					gw: "192.168.0.1",
					netmask: "255.255.255.0"
			};

			wifi.setIP(info, (err) => {
					console.log("IP set!");
					startServer();
			});
		}
	});
};

var page = 'allo guv';

const onHttpRequest = (request, response) => {
	console.log("Processing request");
	response.writeHead(200, { 'Content-Type': 'text/html' });
	response.end(page);
};

const startServer = () => {
	console.log("Starting Server");
	ws
		.createServer(onHttpRequest)
		.listen(80)
		.on("websocket", (socket) => {
			console.log("websocket connection");
			socket.on("message", (msg) => {
				console.log("websocket message: " + msg);
				socket.send("pong");
			});
		});

};

function onInit() {
	connectToWifi();
}
onInit();
