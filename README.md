# Description
node-airplayhub is an AirPlay server which accepts streams (using [nodetunes](https://github.com/stephen/nodetunes)) and then streams the audio back out to multiple AirPlay devices with sync support (using [node_airtunes](https://github.com/lperrin/node_airtunes)).

# Installation

## 1. Pre Reqs
To install this package you will need to install these packages first:
``` bash
$ apt-get install -y build-essential git libavahi-compat-libdnssd-dev nodejs npm nodejs-legacy
```

## 2. Install
``` bash
$ npm i -g git+https://github.com/noelhibbard/node-airplayhub
```

## 3. Config file
The first time you launch node-airplayhub it will generate a config file and automatically populate it with all the AirPlay targets that are advertizing on your network. The default location is ./config.json. If you want to spesify a different location, use the -c or --config option. Here is what the config file looks like:

``` json
{
    "servername": "[AirPlay Hub]",
    "webuiport": 8089,
    "debug": false,
    "idletimout": 600,
    "zones": [
        {
            "name": "Room1",
            "host": "127.0.0.1",
            "port": "5000",
            "volume": "50",
            "enabled": false,
            "hidden": false
        },
        {
            "name": "Room2",
            "host": "127.0.0.1",
            "port": "5001",
            "volume": "50",
            "enabled": false,
            "hidden": false
        },
        {
            "name": "Apple TV",
            "host": "192.168.0.21",
            "port": "5000",
            "volume": "50",
            "enabled": false,
            "hidden": true,
            "alias": "TV in Livingroom"
        }
    ]
}
```

- **servername**: The name you will see from your iDevice.
- **webuiport**: This is the port number used for the WebUI which is used to select the AirPlay destinations.
- **debug**: Highly verbous output to the console.
- **idletimeout**: This time is set in seconds. When you disconnect or pause output it starts this timer. when the timer expires it turns off all outputs. This is to prevent you from coming back hours later, say 12AM, and acidetially blasting music on your back porch. Setting this to a 0 will disable the idle timout.
- **zones**: This is where you define which AirPlay destinations you want to have available.
- **name**: AirPlay destination name.
- **alias**: Alias gives a way to override the destination name that is displayed in the WebUI.
- **host**: The host name of the AirPlay device.
- **port**: Port number of the AirPlay device.
- **volume**: This sets the initial volume level of the AirPlay device but it is updated dinamically as you chantge volume in the WebUI.
- **enabled**: Whether output is enabled or not. This value is also updated dynamically as you turn outputs on and off.
- **hidden**: There may be some devices you never want to use. In that case you can set the zone to hidden.

Place the config file somewhere like this /etc/airplayhub.json

## 4. Launch
Launch node-airplayhub like this to see the command line options:
``` bash
$ node-airplayhub --help
```

Once you start node-airplayhub you can browse to http://[hostname]:[webuiport]/ to select zones and set volume levels.

# Service
I also included a systemd service file (node-airplayhub.service) which you can edit it to your liking and then place it in /etc/systemd/system then use this command to enable the service:
``` bash
$ systemctl enable node-airplayhub
```

Then this to start the service:
``` bash
$ service node-airplayhub start
```

