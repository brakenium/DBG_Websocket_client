const WebSocket = require('ws');
const internalWS = new WebSocket('ws://0.0.0.0:8080');

const send = 'send_last_MetagameEvents_Miller';

internalWS.on('open', function incoming() {
	console.log('internalWS is open');
	internalWS.send(send);
});

internalWS.on('message', function incoming(data) {
	console.log(data);
	internalWS.close();
});
