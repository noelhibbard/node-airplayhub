#!/usr/bin/env node

var config;
var zones;
var argv = require('minimist')(process.argv.slice(2));
if (!argv.c && !argv.config) {
    console.log('usage: node-airplayhub [options]\n  options:\n    -c, --config     Path to config file')
    process.exit();
} else {
    if (argv.c) {
        config = require(argv.c);
    } else if (argv.config) {
        config = require(argv.config);
    }
    zones = config.zones;
}

var express = require('express');
var logger = require('morgan');
var path = require('path');
var app = express();
var http = require('http');
var airtunes = require('airtunes')
var airtunesserver = require('nodetunes');
var fs = require('fs')
var connectedDevices = [];
var trackinfo = {};
var idleTimer;

var server = new airtunesserver({ serverName: config.servername, verbose: config.debug });

server.on('clientConnected', function (stream) {
    clearTimeout(idleTimer);
    stream.pipe(airtunes);
    for (var i in zones) {
        if (zones[i].enabled) {
            connectedDevices[i] = airtunes.add(zones[i].host, { port: zones[i].port, volume: zones[i].volume });
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

server.on('volumeChange', (data) => {
    clearTimeout(idleTimer);
});

server.start();

if (config.debug) { app.use(logger('dev')) };

app.use('/icons', express.static(path.join(__dirname, 'root/icons'), { maxAge: '1y' }));
app.use(express.static(path.join(__dirname, 'root'), { setHeaders: (res, path, stat)=> {
    res.setHeader('Cache-Control', 'public, max-age=0');
}}));

http.createServer(app).listen(config.webuiport);

app.get('/', (req, res) => { res.redirect('/Index.html') });

app.get('/startzone/:zonename', function (req, res) {
    var zonename = req.params.zonename;
    var resp = { error: "zone not found" };
    for (var i in zones) {
        if (zones[i].name.toLowerCase() == zonename.toLowerCase()) {
            connectedDevices[i] = airtunes.add(zones[i].host, { port: zones[i].port, volume: zones[i].volume });
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
                connectedDevices[i].setVolume(volume);
            }
            resp = zones[i];
        }
    }
    config.zones = zones;
    fs.writeFileSync('./config.json', JSON.stringify(config, null, 4));
    res.json(resp);
});

app.get('/zones', function (req, res) {
    res.json(zones);
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