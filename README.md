# kiss-tnc
Talk to a packet radio KISS TNC over a serial port.

```js
'use strict';
const KISS_TNC = require('kiss-tnc');
const AX25 = require('ax25');

function log_packet(data) {
    const packet = new AX25.Packet();
    packet.disassemble(data.data);
    console.log(`Packet received on port ${data.port}`);
    console.log('source', packet.source);
    console.log('destination', packet.destination);
}

// device, baud_rate
const tnc = new KISS_TNC('/dev/ttyACM0', 115200);
tnc.on('error', console.log);
tnc.on('data', log_packet);
tnc.open(() => console.log('TNC opened'));

```

## Constructor

```js
new KISS_TNC(device, baud_rate);
```

* device _(String, required)_
    * A named serial port
    * eg. _'/dev/ttyUSB0'_, _'/dev/ttyACM0'_, _'COM4'_
* baud_rate _(Number, required)
    * Communication rate between host and TNC over the serial port
    * eg. _9600_, _115200_
    * This has nothing to do with the over-the-air data rate of the TNC

## Events

    * data
        * Listener will receive an Object parameter
            * { port, command, data }
        * _data_ is a Buffer, the contents of a KISS frame received from the TNC
            * This should be an AX.25 frame without any start flag, Frame Check Sequence, or stop flag
        * _port_ is the HDLC (radio) port that the data was received from
            * This is usually zero
        * _command_ is the KISS command number
            * This is usually zero, and I'm not aware of a scenario where a KISS TNC sends other types of commands to the host

## Methods

* open([callback])
    * Passthrough to [SerialPort.open](https://www.npmjs.com/package/serialport#module_serialport--SerialPort+open)
    * Call this method after you've set up your event handlers
    * Data will not be read from and cannot be written to the TNC until this has been called
* close([callback])
    * Passthrough to [SerialPort.close](https://www.npmjs.com/package/serialport#module_serialport--SerialPort+close)
    * Call this method when you're done communicating with the TNC (ie. before your program exits)
* set_tx_delay(value = 50, callback, port = 0)
    * value * 10 = tx_delay in ms
* set_persistence(value = 63, callback, port = 0)
    * value / 255 = persistence
* set_slot_time(value = 10, callback, port = 0)
    * value * 10 = slot_time in ms
* set_tx_tail(value = 1, callback, port = 0)
    * value * 10 = tx_tail in ms
* set_duplex(value = 0, callback, port = 0)
    * 0 for half duplex, 1 - 255 for full duplex
* set_hardware(value, callback, port = 0)
    * 'value' must be a Buffer. Its contents are entirely up to you and your TNC
* send_data(data, callback, port = 0)
    * 'data' must be a buffer, ie. an AX.25 frame less the start/stop flags and FCS
* exit_kiss(callback)
    * Take the TNC out of KISS mode, if it has any other mode to return to
    * Not all TNCs support this; many that do need to be restarted afterward
