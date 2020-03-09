const wifi = require("Wifi");
const http = require("http");

const WIFI_NAME = "FiOS-52W4I";
const WIFI_OPTIONS = { password : "fund9388ion9279net" };
const connectToWifi = () => {
	wifi.connect(WIFI_NAME, WIFI_OPTIONS, (err)  => {
		if (err) {
		  console.log("Connection error: " + err);
		  return;
		} else {
			console.log("Wifi Connected!");
			wifi.getIP((err, info) => {
				if (info && info.ip) {
					console.log("IP Address: " + info.ip );
                    startServer();
				}
			});
		}
	});
};

const onHttpRequest = (request, response) => {
    console.log("Processing request");
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.write("<html><body>Boom</body></html>");
    response.end("</body></html>");
};

const startServer = () => {
    console.log("Starting Server");
    http.createServer(onHttpRequest).listen(80);
};

function onInit() {
	connectToWifi();
}
onInit();
