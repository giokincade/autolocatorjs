const WIFI_NAME = "FiOS-52W4I";
const WIFI_OPTIONS = { password : "fund9388ion9279net" };

function onInit() {
	const wifi = require("Wifi");
	wifi.connect(WIFI_NAME, WIFI_OPTIONS, (err)  => {
	if (err) {
	  console.log("Connection error: " + err);
	  return;
	} else {
		console.log("Wifi Connected!");
	}
	});
}
onInit();
