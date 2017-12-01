'use strict';
const EventEmitter = require('events');
const SerialPort = require('serialport');

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

    constructor (device, baud_rate, port = 0) {

        super();

        let rx_buffer = Buffer.from([]);

        const handle = new SerialPort(device, { baudRate : baud_rate, autoOpen : false });
        handle.on('error', (err) => this.emit('error', err));
        handle.on(
            'data', (data) => {
                rx_buffer = Buffer.concat([rx_buffer, data]);
                const arr = [];
                let in_frame = false;
                let escaped = false;
                for (let offset = 0; offset < rx_buffer.length; offset++) {
                    let byte = rx_buffer.readUInt8(offset);
                    if (!in_frame) {
                        in_frame = (byte == defs.framing.fend);
                    } else if (byte == defs.framing.fend) {
                        rx_buffer = rx_buffer.slice(offset + 1);
                        this.emit('data', Buffer.from(arr));
                        byte = null;
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
        );
        this.open = handle.open;
        this.close = handle.close;

        this._send_command = function (command, data = Buffer.from([]), callback = () => {}) {
            if (typeof command != 'number' || command < 0 || (command > 6 && command != 255)) {
                throw `Invalid command ${command}`;
            } else if (!Buffer.isBuffer(data)) {
                throw `Invalid data ${data}`;
            } else {
                let tx_buffer = [ defs.framing.fend, command&(port<<4) ];
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
                handle.write(tx_buffer);
                handle.drain(callback);
            }
        }

    }

    // value * 10 = tx_delay in ms
    set_tx_delay(value = 50, callback) {
        valid_numeric_setting('tx_delay', value);
        this._send_command(defs.commands.tx_delay, Buffer.from([value]), callback);
    }

    // value / 255 = persistence
    set_persistence(value = 63, callback) {
        valid_numeric_setting('persistence', value);
        this._send_command(defs.commands.persistence, Buffer.from([value]), callback);
    }

    // value * 10 = slot_time in ms
    set_slot_time(value = 10, callback) {
        valid_numeric_setting('slot_time', value);
        this._send_command(defs.commands.slot_time, Buffer.from([value]), callback);
    }

    // value * 10 = tx_tail in ms
    set_tx_tail(value = 1, callback) {
        valid_numeric_setting('tx_tail', value);
        this._send_command(defs.commands.tx_tail, Buffer.from([value]), callback);
    }

    // Zero for half duplex, 1-255 for full duplex
    set_duplex(value = 0, callback) {
        valid_numeric_setting('duplex', value);
        this._send_command(defs.commands.duplex, Buffer.from([value]), callback);
    }

    // 'value' must be a Buffer, but its contents are entirely up to you and your TNC
    set_hardware(value, callback) {
        this._send_command(defs.commands.set_hardware, value, callback);
    }

    // 'data' must be a buffer, ie. an AX.25 frame less the start/stop flags and FCS
    send_data(data, callback) {
        this._send_command(defs.commands.data, data, callback);
    }

    // Take the TNC out of KISS mode, if it has any other mode to return to.
    // Not all TNCs support this; many that do need to be restarted afterward.
    exit_kiss(callback) {
        this._send_command(defs.commands.exit_kiss, undefined, callback);
    }

}

module.exports = KISS_TNC;
