const ws = new WebSocket("ws://" + location.host);'
ws.onmessage = function (event) { console.log("MSG:"+event.data); };
setTimeout(function() { ws.send("Hello to Espruino!"); }, 1000);
