const wifi = require("Wifi");
const ws = require("ws");

const WIFI_NAME = "OceanusStudio";
const WIFI_OPTIONS = { password: "studio125" };

const connectToWifi = () => {
  wifi.connect(WIFI_NAME, WIFI_OPTIONS, (err) => {
    if (err) {
      //console.log("Connection error: " + err);
      return;
    } else {
      //console.log("Wifi Connected!");

      var info = {
        ip: "192.168.0.159",
        gw: "192.168.0.1",
        netmask: "255.255.255.0",
      };

      wifi.setIP(info, (err) => {
        //console.log("IP set!");
        startServer();
      });
    }
  });
};

const getPage = () => {
  var html = "<html><head><title>Autolocator</title></head><body>";
  html +=
    "<script>request=new XMLHttpRequest();request.open('GET', 'http://autolocator.oceanus.nyc/index.html', true);request.send(null);request.onreadystatechange=function (){if (request.readyState===4 && request.status===200){document.body.innerHTML=request.responseText;}}; </script>";
  html += "</body></html>";

  return html;
};

const onHttpRequest = (request, response) => {
  //console.log("Processing request");
  response.writeHead(200, { "Content-Type": "text/html" });
  response.end(getPage());
};

const startServer = () => {
  //console.log("Starting Server");
  ws.createServer(onHttpRequest)
    .listen(80)
    .on("websocket", (socket) => {
      //console.log("websocket connection");
      socket.on("message", (msg) => {
        //console.log("websocket message: " + msg);
        socket.send("pong");
      });
    });
};

function onInit() {
  connectToWifi();
}

//remove on "save();" command in IDE
onInit();
