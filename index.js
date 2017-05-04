#!/usr/bin/env node

var path = require('path');
var fs = require('fs')
var config = {
    "servername": "[AirPlay Hub]",
    "webuiport": 8089,
    "debug": false,
    "idletimout": 600,
    "mastervolume":-15,
    "zones": []
};
var configPath = './config.json';

var argv = require('minimist')(process.argv.slice(2));
if (argv.h || argv.help) {
    console.log('usage: node-airplayhub [options]\n  options:\n    -c, --config     Path to config file')
    process.exit();
} else {
    if (argv.c) configPath = argv.c;
    if (argv.config) configPath = argv.config;
    if(!path.isAbsolute(configPath)) configPath = path.join(__dirname, configPath)
}

try{
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch(e) {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
}

var zones = config.zones;
var express = require('express');
var logger = require('morgan');
var app = express();
var http = require('http');
var airtunes = require('airtunes')
var airtunesserver = require('nodetunes');
var bonjour = require('bonjour')();
var connectedDevices = [];
var trackinfo = {};
var idleTimer;

var server = new airtunesserver({ serverName: config.servername, verbose: config.debug });

server.on('clientConnected', function (stream) {
    clearTimeout(idleTimer);
    stream.pipe(airtunes);
    for (var i in zones) {
        if (zones[i].enabled) {
            connectedDevices[i] = airtunes.add(zones[i].host, { port: zones[i].port,
								volume: compositeVolume(zones[i].volume)});
        }
    }
});

server.on('clientDisconnected', (data) => {
    clearTimeout(idleTimer);
    if (config.idletimout > 0) {
        idleTimer = setTimeout(() => {
            airtunes.stopAll(() => {
                for (var i in zones) {
                    zones[i].enabled = false;
                }
            });
        }, config.idletimout * 1000);
    }
});

server.on('metadataChange', (data) => {
    trackinfo = data;
    getArtwork(trackinfo.asar, trackinfo.asal, (url) => {
        if (url) {
            trackinfo.albumart = url;
        } else {
            trackinfo.albumart = '/genericart.png';
        }
    });
});

function compositeVolume(vol) {
    return(config.mastervolume == -144 ? 0:
	   Math.round(vol*(config.mastervolume+30)/30.));
}
    
server.on('volumeChange', (data) => {
    config.mastervolume = data;		// -30 to 0dB, or -144 for mute
    for (var i in zones) {
        if (zones[i].enabled) {
	    connectedDevices[i].setVolume(compositeVolume(zones[i].volume));
	}
    }
    clearTimeout(idleTimer);
});

server.start();

if (config.debug) { app.use(logger('dev')) };

app.use('/icons', express.static(path.join(__dirname, 'root/icons'), { maxAge: '1y' }));
app.use(express.static(path.join(__dirname, 'root'), {
    setHeaders: (res, path, stat) => {
        res.setHeader('Cache-Control', 'public, max-age=0');
    }
}));

http.createServer(app).listen(config.webuiport);

app.get('/', (req, res) => { res.redirect('/Index.html') });

app.get('/startzone/:zonename', function (req, res) {
    var zonename = req.params.zonename;
    var resp = { error: "zone not found" };
    for (var i in zones) {
        if (zones[i].name.toLowerCase() == zonename.toLowerCase()) {
            connectedDevices[i] = airtunes.add(zones[i].host, { port: zones[i].port,
								volume: compositeVolume(zones[i].volume) });
            zones[i].enabled = true;
            resp = zones[i];
        }
    }
    res.json(resp);
});

app.get('/stopzone/:zonename', function (req, res) {
    var zonename = req.params.zonename;
    var resp = { error: "zone not found" };
    for (var i in zones) {
        if (zones[i].name.toLowerCase() == zonename.toLowerCase()) {
            zones[i].enabled = false;
            if (connectedDevices[i]) {
                connectedDevices[i].stop();
            }
            resp = zones[i];
        }
    }
    res.json(resp);
});

app.get('/setvol/:zonename/:volume', function (req, res) {
    var zonename = req.params.zonename;
    var volume = req.params.volume;
    var resp = { error: "zone not found" };
    for (var i in zones) {
        if (zones[i].name.toLowerCase() == zonename.toLowerCase()) {
            zones[i].volume = volume;
	    if (connectedDevices[i]) {
		connectedDevices[i].setVolume(compositeVolume(volume));
	    }
            resp = zones[i];
        }
    }
    config.zones = zones;
    res.json(resp);
});

app.get('/zones', function (req, res) {
    var zonesNotHidden = zones.filter(function (z) {
        return (!z.hidden);
    });
    res.json(zonesNotHidden);
});

app.get('/hidezone/:zonename', function (req, res) {
    var zonename = req.params.zonename;
    var resp = { error: "zone not found" };
    for (var i in zones) {
        if (zones[i].name.toLowerCase() == zonename.toLowerCase()) {
            zones[i].hidden = true;
            resp = zones[i];
        }
    }
    res.json(resp);
});

app.get('/showzone/:zonename', function (req, res) {
    var zonename = req.params.zonename;
    var resp = { error: "zone not found" };
    for (var i in zones) {
        if (zones[i].name.toLowerCase() == zonename.toLowerCase()) {
            zones[i].hidden = false;
            resp = zones[i];
        }
    }
    res.json(resp);
});

app.get('/trackinfo', function (req, res) {
    res.json(trackinfo);
});

function getArtwork(artist, album, callback) {
    var url = `http://itunes.apple.com/search?term=${artist} ${album}`;

    http.get(url, function (res) {
        var body = '';

        res.on('data', function (chunk) {
            body += chunk;
        });

        res.on('end', function () {
            var albumInfo = JSON.parse(body);
            if (albumInfo.resultCount > 0) {
                callback(albumInfo.results[0].artworkUrl100.replace('100x100', '600x600'));
            } else {
                callback('/genericart.png');
            }
        });
    }).on('error', function (e) {
        callback('/genericart.png');
    });
}

function getIPAddress(service) {

    addresses = service.addresses;
    // Extract right IPv4 address
    var rx = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|$)){4}$/;
    for (var a in addresses) {
        // Test if we can find an ipv4 address
        if (rx.test(addresses[a]) && addresses[a].lastIndexOf('169', 0) !== 0) {
            return addresses[a];
            break;
        }
    }
}

function validateDevice(service) {

    // Extract IP address, hostname and port from mdns descriptor
    service.ip = getIPAddress(service);
    service.id = service.ip + ":" + service.port;
    service.name = service.name.split('@')[1];

    // Ignore self
    if(service.name == config.servername) return;

    // Check whether we know this zone already - if we do, do not add it again
    var zoneUnknown = true;
    for (var i in zones) {
        if (zones[i].name.toLowerCase() == service.name.toLowerCase()) {
            // Duplicate found which already existed in the config. Mind we match on the fqdn the host claims to have.
            zoneUnknown = false;
        }
    }

    // If it is a new zone, thank you very much, add it and write it to our config
    // TODO: I re-used the ./config.json used elsewhere in this application. Ideally, it should take the parameter passed in --config and not just 'require' the file but properly read it and parse it and write it back here
    if (zoneUnknown) {
        zones.push({ "name": service.name, "host": service.ip, "port": service.port, "volume": 0, "enabled": false, "hidden": false });
        config.zones = zones;
    }
};

process.on('SIGTERM', function () {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
    process.exit(1);
});

// browse for all raop services
var browser = bonjour.find({
    type: 'raop'
});

browser.on('up', function (service) {
    validateDevice(service);
});

browser.on('down', function (service) {
    // TODO
});

browser.start();
