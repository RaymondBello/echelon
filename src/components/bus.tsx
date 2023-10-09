import R6502 from "@/components/r6502";


export default class Bus {
    

    // CPU on the bus
    cpu: R6502;

    MIN_RAM_ADDR = 0x0000;
    MAX_RAM_ADDR = 0xFFFF;

    // Fake RAM 64KB (note: compiler might complain about this)
    ram = new Uint8Array(64 * 1024);


    constructor() {

        // Reset RAM content
        for (let i = 0; i < this.ram.length; i++) {
            this.ram[i] = 0x00;
        }

        this.cpu = new R6502();
        // Connect cpu to BUS
        this.cpu.connectBus(this);

    }

    /**
     * @brief write data to a specified address
     * 
     * @param address address to be written to
     * @param data data to be written
     */
    write(address: number, data: number) {

        if (address >= this.MIN_RAM_ADDR && address <= this.MAX_RAM_ADDR) {

        }
        else {
            console.log("[ERROR] Invalid bus write to (addr): ", address);
        }

    }


    /**
     * @brief read data from a  specified address, returns data
     * In normal operation "Read Only" is set to false.
     * Some devices on the bus may change state when they are read from, and this 
     * is intentional under normal circumstances. However the disassembler will
     * want to read the data at an address without changing the state of the
     * devices on the bus
     * 
     * @param address address to be read from
     * @param ReadOnly true if only read is needed, default is false
     * @return uint8_t 
     */
    read(address: number, ReadOnly: Boolean): number {

        if (address >= this.MIN_RAM_ADDR && address <= this.MAX_RAM_ADDR) {
            return this.ram[address];
        } else {
            return 0x00;
        }
    }
}