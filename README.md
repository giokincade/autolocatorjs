# Installation

Run the install script

```
./script/install
```

# Firmware
Make sure to put the board in firmware flashing mode (hold the button while plugging in the USB).

```
./script/upgrade-firmware
```

# Deploy
This deploys `src/test.js` and gives you a REPL. It will take some time for the deploy to complete and for it to connect to the wifi. The Wifi credentials are currently hard-coded.

```
./script/deploy
```
