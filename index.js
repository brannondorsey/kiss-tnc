'use strict';
const EventEmitter = require('events');
const { Socket } = require('net');

const defs = {
    framing : {
    	fend : (1<<6)|(1<<7),
    	fesc : (1<<0)|(1<<1)|(1<<3)|(1<<4)|(1<<6)|(1<<7),
    	tfend : (1<<2)|(1<<3)|(1<<4)|(1<<6)|(1<<7),
    	tfesc : (1<<0)|(1<<2)|(1<<3)|(1<<4)|(1<<6)|(1<<7),
    },
    commands : {
    	data : 0,
    	tx_delay : 1,
    	persistence : 2,
    	slot_time : 3,
    	tx_tail : 4,
    	duplex : 5,
    	set_hardware : 6,
    	exit_kiss : 255
    }
};

function valid_numeric_setting(setting, value) {
    if (typeof value != 'number' || value < 0 || value > 255) {
        throw `Invalid ${setting}: ${value}`;
    }
}

/*  This will throw exceptions if you try to do incorrect things.  Your program
    should not do incorrect things, and if it does, it should be ready to catch
    an exception. */
class KISS_TNC extends EventEmitter {

    constructor (device, baud_rate) {

        super();

        let socket = null
        let serial = null
        let rx_buffer = Buffer.from([]);

        // if the device is a network location
        if (device.startsWith('kiss://')) {

            const network_location = device.substring(7)
            const split = network_location.split(':')
            if (split.length != 2) {
                throw TypeError('kiss:// device location must be in the format "kiss://host:port".')
            }
            const host = split[0]
            const port = parseInt(split[1])
            if (isNaN(port)) throw TypeError('kiss:// device must include a valid port number.')
            else if (port < 0 || port > 65535) {
                throw TypeError('kiss:// device port must be an integer between 0 and 65535.')
            }

            socket = new Socket({ readable: true, writable: true })
            socket.on('error', (err) => this.emit('error', err))
            socket.on('data', (data) => this._on_data_rx(rx_buffer, data))

            this.open = (callback) => {
                socket.on('connect', callback)
                socket.connect({ host, port })
            }

            this.close = (callback) => {
                socket.on('close', callback)
                socket.end()
            }

        // if the device is a serial device
        } else {
            // lazy load the serialport module, only if its needed
            const SerialPort = require('serialport');
            serial = new SerialPort(device, { baudRate : baud_rate, autoOpen : false });
            serial.on('error', (err) => this.emit('error', err));
            serial.on('data', (data) => this._on_data_rx(rx_buffer, data));
            this.open = (callback) => serial.open(callback);
            this.close = (callback) => serial.close(callback);
        }

        this._send_command = function (command, port = 0, data = Buffer.from([]), callback = () => {}) {
            if (typeof command != 'number' || command < 0 || (command > 6 && command != 255)) {
                throw `Invalid command ${command}`;
            } else if (!Buffer.isBuffer(data)) {
                throw `Invalid data ${data}`;
            } else {
                const tx_buffer = this._get_tx_buffer(command, port, data)
                // if we're using a serial port
                if (serial != null) {
                    serial.write(tx_buffer);
                    serial.drain(callback);
                // if we are using a network socket
                } else if (socket != null) {
                    socket.write(Buffer.from(tx_buffer), null, callback)
                } else {
                    throw Error('Cannot send command, both socket and serial are null.')
                }
            }
        }
    }

    _on_data_rx(rx_buffer, data) {
        rx_buffer = Buffer.concat([rx_buffer, data]);
        let arr = [];
        let in_frame = false;
        let escaped = false;
        for (let offset = 0; offset < rx_buffer.length; offset++) {
            let byte = rx_buffer.readUInt8(offset);
            if (!in_frame) {
                in_frame = (byte == defs.framing.fend);
            } else if (byte == defs.framing.fend) {
                rx_buffer = rx_buffer.slice(offset + 1);
                this.emit(
                    'data', {
                        port : ((arr[0]&(15<<4))>>4),
                        command : (arr[0]&15),
                        data : Buffer.from(arr.slice(1))
                    }
                );
                arr = [];
                offset = 0;
                in_frame = false;
                escaped = false;
            } else if (!escaped && byte == defs.framing.fesc) {
                escaped = true;
            } else if (escaped) {
                if (byte == defs.framing.tfesc) {
                    arr.push(defs.framing.fesc);
                } else if (byte == defs.framing.tfend) {
                    arr.push(defs.framing.fend);
                }
                escaped = false;
            } else {
                arr.push(byte);
            }
        }
    }

    _get_tx_buffer(command, port, data) {
        let tx_buffer = [ defs.framing.fend, command|(port<<4) ];
        for (let offset = 0; offset < data.length; offset++) {
            let byte = data.readUInt8(offset);
            if (byte == defs.framing.fend) {
                tx_buffer = tx_buffer.concat([ defs.framing.fesc, defs.framing.tfend ]);
            } else if (byte == defs.framing.fesc) {
                tx_buffer = tx_buffer.concat([ defs.framing.fesc, defs.framing.tfesc ]);
            } else {
                tx_buffer.push(byte);
            }
        }
        tx_buffer.push(defs.framing.fend);
        return tx_buffer;
    }

    // value * 10 = tx_delay in ms
    set_tx_delay(value = 50, callback, port = 0) {
        valid_numeric_setting('tx_delay', value);
        this._send_command(defs.commands.tx_delay, port, Buffer.from([value]), callback);
    }

    // value / 255 = persistence
    set_persistence(value = 63, callback, port = 0) {
        valid_numeric_setting('persistence', value);
        this._send_command(defs.commands.persistence, port, Buffer.from([value]), callback);
    }

    // value * 10 = slot_time in ms
    set_slot_time(value = 10, callback, port = 0) {
        valid_numeric_setting('slot_time', value);
        this._send_command(defs.commands.slot_time, port, Buffer.from([value]), callback);
    }

    // value * 10 = tx_tail in ms
    set_tx_tail(value = 1, callback, port = 0) {
        valid_numeric_setting('tx_tail', value);
        this._send_command(defs.commands.tx_tail, port, Buffer.from([value]), callback);
    }

    // Zero for half duplex, 1-255 for full duplex
    set_duplex(value = 0, callback, port = 0) {
        valid_numeric_setting('duplex', value);
        this._send_command(defs.commands.duplex, port, Buffer.from([value]), callback);
    }

    // 'value' must be a Buffer, but its contents are entirely up to you and your TNC
    set_hardware(value, callback, port = 0) {
        this._send_command(defs.commands.set_hardware, port, value, callback);
    }

    // 'data' must be a buffer, ie. an AX.25 frame less the start/stop flags and FCS
    send_data(data, callback, port = 0) {
        this._send_command(defs.commands.data, port, data, callback);
    }

    // Take the TNC out of KISS mode, if it has any other mode to return to.
    // Not all TNCs support this; many that do need to be restarted afterward.
    exit_kiss(callback) {
        this._send_command(defs.commands.exit_kiss, undefined, undefined, callback);
    }
}

module.exports = KISS_TNC;
