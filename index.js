// Defines wich libraries are used
const WebSocket = require('ws');
const { JSONPath } = require('jsonpath-plus');
const fs = require('fs');

// Loads all necessary files
const config = require('./json/config.json');
const constants = require('./json/constants.json');

// Defines all websockets
const DBGWebsocket = new WebSocket(`wss://push.planetside2.com/streaming?environment=ps2&service-id=s:${config.dbg_api.service_id}`);
const internalWSServer = new WebSocket.Server({ port: 8080 });


// This function saves files to a specified filepath and throws an error if it has one
function saveData(filepath, data) {
	fs.writeFile(filepath, data, function(err) {
		if (err) throw err;
	});
}

// This function reads data from a file and sends it to the websocket which is the first variable (ws).
// To do this it uses the properties and zones variables which gives it everything it needs to find the files which need to be send.
function resendMetagameEvent(properties, zones, ws) {
	// Loops the code for every zone
	for (let i = 0, len = zones.length; i < len; i++) {

		const filepath = `./json/${properties[0]}/${properties[1]}/${properties[2]}/zone_${zones[i]}.json`;

		// Checks if the filepath exists
		if (fs.existsSync(filepath)) {

			// Saves the content in a variable
			const data = fs.readFileSync(filepath);

			// Sends the content to the websocket specified in the 'ws' variable
			console.log(`(IWS) Sending saved data to the websocket for zone: ${zones[i]}`);
			ws.send(data);

		} else {
			console.log(`The filepath for zone: ${zones[i]}, doesn't exist, not send`);
		}
	}
}

function worldNameFromID(world_id) {
	// Gets the worldname from the constants file using world_id
	return JSONPath(`$.worlds[?(@.world_id==${world_id})].name`, constants);
}

function continentStatusAppend(parsedData) {
	const data = parsedData + '\n';
	const world_name = worldNameFromID(parsedData.payload.world_id);
	// Appends the received continent status to the defined filepath
	fs.appendFile(`./json/Continent(Un)Lock/${world_name}/all.json`, data, function(err) {
		if (err) throw err;
	});
}

// This websocket client listens to the daybreakgames API websocket server
// The following wil let client DBGWebsocket send a message to the websocket server to send messages for the following events:
// 		1.MetagameEvent on world 10 (game servers)
// 		2.ContinentUnlock
//		3.ContinentLock
DBGWebsocket.on('open', function open() {
	console.log('DBG websocket open');

	// Listens to MetagameEvents on the DBGWebsocket on world 10 (Miller)
	DBGWebsocket.send(JSON.stringify(config.dbg_api.command));

	// This let's client "DBGWebsocket" listen to incoming messages and puts the data that needs to be saved in the right location
	DBGWebsocket.on('message', function incoming(data) {

		// Parses 'data' and stores it in 'parsedData'
		const parsedData = JSON.parse(data);

		// Filters the parsedData.types
		switch(parsedData.type) {
		// Makes sure only serviceMessages are filtered further
		case 'serviceMessage': {
			switch(parsedData.payload.event_name) {
			case 'MetagameEvent': {
				console.log(`(sM) Type is "${parsedData.payload.event_name}"`);

				// Grabs the worldname from 'constants.json'. It grabs it from the worlds map and filters it to only show entries with the world ID received from the DBG API
				// It then grabs the name from entry and saves it in world_name
				const world_name = worldNameFromID(parsedData.payload.world_id);

				// Grabs the zone ID from 'constants.json'. It grabs it from metagame_event_list map and filters it to only show entries with the metagame_event_id from the DBG API
				// Then it grabs the zone_id from the entry and saves it in zone_id
				const zone_id = JSONPath(`$.metagame_event_list[?(@.metagame_event_id==${parsedData.payload.metagame_event_id})].zone_id`, constants);

				// Defines the filepath and saves the data in that file
				const filepath = `./json/${parsedData.payload.event_name}/${world_name}/last/zone_${zone_id}.json`;
				saveData(filepath, data);

				// Checks if zone_id is other
				if (zone_id == 'other') {
					// Defines the necessary variables to save the alert with zone_id: 'other' in a file and saves it there
					const date = new Date();
					const filepath_all_other = `./json/${parsedData.payload.event_name}/${world_name}/all_other/${date}.json`;
					saveData(filepath_all_other, data);
				}
				console.log(`World name:${world_name}\nZone_ID: ${zone_id}`);
				break;
			}
			case 'ContinentLock': {
				console.log(`(CL) Type is "${parsedData.payload.event_name}"`);
				continentStatusAppend(parsedData);
				break;
			}
			case 'ContinentUnlock': {
				console.log(`(CU) Type is "${parsedData.payload.event_name}"`);
				continentStatusAppend(parsedData);
				break;
			}
			}
			break;
		}
		case 'heartbeat': {
			break;
		}
		default: {
			console.log(`(ns) Type is not specified in filter: ${parsedData.type}`);
			break;
		}
		}
	});

	// internalWSServer is the websocket server meant to be used by the discord bot
	// internalWS is the client for internalWSServer. internalWSServer is used by the internal communications between this program and the discord bot
	internalWSServer.on('connection', function connection(ws) {
		console.log('Internal websocket running');

		// This listens to messages on internalWS
		ws.on('message', function incoming(message) {
			const parsed_message = JSON.parse(message);

			// This switch statement holds all internal websocket commands
			switch(parsed_message.type) {

			// This command grabs the last MetagameEvents (alerts) from Miller that are in the json folder
			case 'metagameEventsRequest': {
				if (parsed_message.payload.which == 'last') {
					// This defines the properties needed for the MetagameEvent filepath
					const properties = ['MetagameEvent', 'Miller', 'last'];
					const zones = parsed_message.payload.zone_id;

					// This will go through each zone for miller and send their last alerts (MetagameEvents) to internalWS, these can be all alert states.
					resendMetagameEvent(properties, zones, ws);
				}
			}
			}
		});

		// Listen to the DBGWebsocket and forward incoming MetagameEvents
		DBGWebsocket.on('message', function incoming(data) {
			// Parses 'data' and stores it in 'parsedData'
			const parsedData = JSON.parse(data);

			// Filters the parsedData.types
			switch(parsedData.type) {
			case 'serviceMessage': {
				if (parsedData.payload.event_name) {
					console.log('(sM) Sending the DBGWebsocket data that just arrived');
					ws.send(data);
				}
				break;
			}
			}
		});
	});
});