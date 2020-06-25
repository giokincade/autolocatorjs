const wifi = require("Wifi");
const ws = require("ws");

const WIFI_NAME = "MeowNetJr";
const WIFI_OPTIONS = { password : "cookiejr" };
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

var page = '<html><body><script>var ws;setTimeout(function(){';
page += 'const ws = new WebSocket("ws://" + location.host);';
page += 'ws.onmessage = function (event) { console.log("MSG:"+event.data); };';
page += 'setTimeout(function() { ws.send("Hello to Espruino!"); }, 1000);';
page += '</script><p>something</p></body></html>';

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
            })
        });

};

function onInit() {
	connectToWifi();
}
onInit();
