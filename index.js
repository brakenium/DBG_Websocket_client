const WebSocket = require('ws');
const fs = require('fs');
const config = require('./json/config.json');
const constants = require('./json/constants.json');
const DBGWebsocket = new WebSocket(`wss://push.planetside2.com/streaming?environment=ps2&service-id=s:${config.dbg_api.service_id}`);
const internalWSServer = new WebSocket.Server({ port: 8080 });
const internalWS = new WebSocket('ws://0.0.0.0:8080');
const { JSONPath } = require('jsonpath-plus');

// This function saves files
function saveData(dir, data) {
	fs.writeFile(dir, data, function(err) {
		if (err) throw err;
		// console.log('Saved!');
	});
}

// This function reads data from a file
function readData(dir) {
	let result;
	fs.readFile(dir, (err, data) => {
		if (err) throw err;
		console.log(data);
		result = data;
	});
	return result;
}

// This function reads data from a file and sends it to the websocket which is the first variable (ws)
function resendWebsocketData(ws, dir) {
	readData(dir);
	ws.send();
}

// internalWSServer is the websocket server meant to be used by the discord bot
// internalWS is the client for internalWSServer. internalWSServer is used by the internal communications between this program and the discord bot
internalWSServer.on('connection', function connection(ws) {
	console.log('Internal websocket running');

	// This listens to messages on internalWS
	ws.on('message', function incoming(message) {
		console.log('received: %s', message);

		// This switch statement holds all internal websocket commands
		switch(message) {
		// This command grabs the last MetagameEvents (alerts) from Miller that are in the json folder
		case 'send_last_MetagameEvents_Miller': {
			// This defines the properties needed for the MetagameEvent directory
			const properties = ['MetagameEvent', 'Miller', 'last'];
			{
				// This defines the directory where the MetagameEvent files are located and sends that specified file
				// This is for zone 2 (Indar)
				const dir = `./json/${properties[0]}/${properties[1]}/${properties[2]}/zone_2.json`;
				resendWebsocketData(ws, dir);
			}
			{
				// This defines the directory where the MetagameEvent files are located and sends that specified file
				// This is for zone 4 (Hossin)
				const dir = `./json/${properties[0]}/${properties[1]}/${properties[2]}/zone_4.json`;
				resendWebsocketData(ws, dir);
			}
			{
				// This defines the directory where the MetagameEvent files are located and sends that specified file
				// This is for zone 6 (Amerish)
				const dir = `./json/${properties[0]}/${properties[1]}/${properties[2]}/zone_6.json`;
				resendWebsocketData(ws, dir);
			}
			{
				// This defines the directory where the MetagameEvent files are located and sends that specified file
				// This is for zone 8 (Esamir)
				const dir = `./json/${properties[0]}/${properties[1]}/${properties[2]}/zone_8.json`;
				resendWebsocketData(ws, dir);
			}
			{
				// This defines the directory where the MetagameEvent files are located and sends that specified file
				// This is for zone other, all alerts that dont't have a zone specified will be send using this
				const dir = `./json/${properties[0]}/${properties[1]}/${properties[2]}/zone_other.json`;
				resendWebsocketData(ws, dir);
			}
		}
		}
	});
});

// This websocket client listens to the daybreakgames API websocket server
// The following wil let client DBGWebsocket send a message to the websocket server to send messages for the following events:
// 		1.MetagameEvent on all worlds (game servers)
// 		2.Nothing yet....
DBGWebsocket.on('open', function open() {
	console.log('DBG websocket open');
	DBGWebsocket.send('{"service":"event","action":"subscribe","worlds":["10", "19", "17", "1", "13", "40"],"eventNames":["MetagameEvent"]}');


	// This let's client "DBGWebsocket" listen to incoming messages and puts the data that needs to be saved in the right location
	DBGWebsocket.on('message', function incoming(data) {
		const parsedData = JSON.parse(data);
		let dir;

		switch(parsedData.type) {
		default: {
			console.log(`(ns) Type is not specified in filter: ${parsedData.type}`);
			break;
		}
		case 'heartbeat': {
			console.log(`(hb) Type is "${parsedData.type}"`);
			dir = './json/heartbeat/last/heartbeat.json';
			saveData(dir, data);
			break;
		}
		case 'serviceMessage': {
			console.log(`(sM) Type is "${parsedData.type}"`);
			internalWS.send(data);
			const world_name = JSONPath(`$.worlds[?(@.world_id==${parsedData.payload.world_id})].name`, constants);
			const zone_id = JSONPath(`$.metagame_event_list[?(@.metagame_event_id==${parsedData.payload.metagame_event_id})].zone_id`, constants);
			console.log(world_name);
			console.log(zone_id);
			dir = `./json/${parsedData.payload.event_name}/${world_name}/last/zone_${zone_id}.json`;
			saveData(dir, data);
			if (zone_id == 'other') {
				const date = new Date();
				dir = `./json/${parsedData.payload.event_name}/${world_name}/all_other/${date}.json`;
				saveData(dir, data);
			}
			break;
		}
		}
	});
});