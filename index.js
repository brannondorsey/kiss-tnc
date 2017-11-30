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
    	full_duplex : 5,
    	set_hardware : 6,
    	exit_kiss : 255
    }
};

class KISSTNC {

    constructor (device, baud_rate, tx_delay = 50, persistence = 63, slot_time = 10, tx_tail = 1, full_duplex = false) {

    }

}
