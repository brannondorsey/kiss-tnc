'use strict';
const KISS_TNC = require('.');
const AX25 = require('../node-ax25'); // https://github.com/echicken/node-ax25/tree/es6rewrite

function log_packet(data) {
    const packet = new AX25.Packet();
    packet.disassemble(data.data);
    console.log(`Packet received on port ${data.port}`);
    console.log('Destination:', packet.destination);
    console.log('Source:', packet.source);
    console.log('Type:', packet.type_name);
    if (packet.payload.length > 0) {
        console.log('Payload:', packet.payload.toString('ascii'));
    }
}

function send_string(str) {
    const packet = new AX25.Packet();
    packet.type = AX25.Masks.control.frame_types.u_frame.subtypes.ui;
    packet.source = { callsign : 'KC3LZO', ssid : 0 };
    packet.destination = { callsign : 'CQ', ssid : 0 };
    packet.payload = Buffer.from(str, 'ascii');
    
    //// send data via serial
    tnc.send_data(packet.assemble(), () => console.log('Sent:', str));
}

// device, baud_rate
const tnc = new KISS_TNC('kiss://localhost:8001', 9600);
process.on('SIGTERM', tnc.close);

tnc.on('error', console.error);
tnc.on('data', log_packet);
tnc.open(() => {

    console.log('TNC opened');

    // send an example message every 2 seconds
    setInterval(() => {
        send_string('This is a message dude.');
    }, 2000)
});

// close the socket and exit the program after 7 seconds
setTimeout(() => {
    console.log('closing the TNC connection...')
    tnc.close(() => {
        console.log('the TNC connection is now closed.')
        process.exit(0)
    })
}, 7000)
