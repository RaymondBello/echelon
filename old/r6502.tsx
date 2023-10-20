
import Bus from "./bus";




// The status register stores 8 flags
enum FLAGS6502 {
    C = (1 << 0), //Carry Bit
    Z = (1 << 1), // Zero
    I = (1 << 2), // Disable Interrupts
    D = (1 << 3), // Decimal Mode (unused in this implementation)
    B = (1 << 4), // Break 
    U = (1 << 5), // Unused
    V = (1 << 6), // Overflow
    N = (1 << 7), //Negative
};

export default class R6502 {

    IRQB = new Uint16Array([0xFFFE]);  // Interupt Vector
    RESB = new Uint16Array([0xFFFC]);  // Reset Vector
    NMIB = new Uint16Array([0xFFFA]);  // Non-Maskable Interrupt


    // R6502 Core registers
    a      = new Uint8Array([0x00]);   // Accumulator Register
    x      = new Uint8Array([0x00]);   // X Register
    y      = new Uint8Array([0x00]);   // Y Register
    stkp   = new Uint8Array([0x00]);   // Stack Pointer (points to location on bus)
    status = new Uint8Array([0x00]);   // Status Register
    pc     = new Uint16Array([0x0000]);// Program Counter

    // Assistive variables to facilitate emulation
    fetched     = new Uint8Array([0x00]);     // Represents the working input value to the ALU
    opcode      = new Uint8Array([0x00]);      // Is the instruction byte
    cycles      = 0;         // Counts how many cycles the instruction has remaining
    temp        = new Uint16Array([0x0000]);     // A convenience variable used everywhere
    addr_abs    = new Uint16Array([0x0000]); // All used memory addresses end up in here
    addr_rel    = new Uint8Array([0x00]);   // Represents absolute address following a branch
    clock_count = 0;   // A global accumulation of the number of clocks

    bus!: Bus;

    constructor(
        
    ) { }

    // Link this CPU to a communications bus
    connectBus(n: Bus) {
        this.bus = n;
    }

    /**
     * @brief Read data from a specified address, returns data
     * 
     * @param addr address to be read from
     * @return uint8_t 
     */
    read(addr: number) {
        return this.bus.read(addr, false);
    }

    /**
     * @brief Write data to a specified address
     * 
     * @param addr address to be written to
     * @param data data to be written
     */
    write(addr: number, data: number)
    {
        return this.bus.write(addr, data);
    }

    //////////////////// FLAG FUNCTIONS /////////////////
    /**
     * @brief Returns the value of a specific bit of the status register  
     * 
     * @param f bit of status register to check 
     * @return uint8_t value of status register
     */
    GetFlag(f: FLAGS6502) {
        return ((this.status[0] & f) > 0) ? 1 : 0;
    }

    /**
     * @brief Sets or clears a specific bit of the status register
     * 
     * @param f bit of status register to set/clear
     * @param v value to be set
     */
    SetFlag(f: FLAGS6502, v: boolean | number)
    {
        if (v)
            this.status[0] |= f;
        else
            this.status[0] &= ~f;
    }


    ////////////// ADDRESSING MODES /////////////////
    // 12 Addressing Modes. These functions
    // may adjust the number of cycles required depending upon where
    // and how the memory is accessed, so they return the required
    // adjustment.
    /////////////////////////////////////////////////

    /**
     * @brief IMP - Implied address mode. 
     * There is no additional data required for this instruction.  
     * 
     * @return uint8_t flag if an additional clock cycle is needed in this addressing mode
     */
    IMP(instance: R6502) {
        instance.fetched[0] = instance.a[0];
        return 0;
    }

    /**
     * @brief IMM - Immediate address mode. 
     * This instruction expects the next byte to be used as a value.
     * 
     * @return uint8_t flag if an additional clock cycle is needed in this addressing mode
     */
    IMM(instance: R6502) {
        instance.addr_abs[0] = instance.pc[0]++;
        return 0;
    }

    /**
     * @brief ZP0 - Zero Page Address Mode\n
     * To save program bytes, zero page addressing allows you to absolutely address
     * a location in first 0xFF bytes of address range.
     * 
     * @return uint8_t flag if an additional clock cycle is needed in this addressing mode
     */
    ZP0(instance: R6502) {
        instance.addr_abs[0] = instance.read(instance.pc[0]);
        instance.pc[0]++;
        instance.addr_abs[0] &= 0x00FF;
        return 0;
    }

    /**
     * @brief ZPX - Zero Page with X Offset Address Mode. 
     * Fundamentally the same as Zero Page addressing, but the contents of the X Register
     * is added to the supplied single byte address.
     * 
     * @return uint8_t flag if an additional clock cycle is needed in this addressing mode
     */
    ZPX(instance: R6502) {
        instance.addr_abs[0] = (instance.read(instance.pc[0]) + instance.x[0]);
        instance.pc[0]++;
        instance.addr_abs[0] &= 0x00FF;
        return 0;
    }

    /**
     * @brief ZPY - Zero Page with Y Offset Address Mode\n
     * Same as above but uses Y Register for offset
     * 
     * @return uint8_t flag if an additional clock cycle is needed in this addressing mode
     */
    ZPY(instance: R6502) {
        instance.addr_abs[0] = (instance.read(instance.pc[0]) + instance.y[0]);
        instance.pc[0]++;
        instance.addr_abs[0] &= 0x00FF;
        return 0;
    }

    /**
     * @brief REL - Relative address mode\n
     * This address mode is exclusive to branch instructions.
     * 
     * @return uint8_t flag if an additional clock cycle is needed in this addressing mode
     */
    REL(instance: R6502) {
        instance.addr_rel[0] = instance.read(instance.pc[0]);
        instance.pc[0]++;
        if (instance.addr_rel[0] & 0x80)
            instance.addr_rel[0] |= 0xFF00;
        return 0;
    }

    /**
     * @brief ABS - Absolute Address Mode\n
     * A full 16-bit address is loaded and used
     * 
     * @return uint8_t flag if an additional clock cycle is needed in this addressing mode
     */
    ABS(instance: R6502) {
        const lo = instance.read(instance.pc[0]);
        instance.pc[0]++;
        const hi = instance.read(instance.pc[0]);
        instance.pc[0]++;

        instance.addr_abs[0] = (hi << 8) | lo;

        return 0;
    }

    /**
     * @brief ABX - Absolute with X Offset Address Mode\n
     * Fundamentally the same as absolute addressing, but the contents of the X Register is added to the supplied two byte address. 
     * If the resulting address changes the page, an additional clock cycle is required
     * 
     * @return uint8_t flag if an additional clock cycle is needed in this addressing mode
     */
    ABX(instance: R6502) {
        const lo = instance.read(instance.pc[0]);
        instance.pc[0]++;
        const hi = instance.read(instance.pc[0]);
        instance.pc[0]++;

        instance.addr_abs[0] = (hi << 8) | lo;
        instance.addr_abs[0] += instance.x[0];

        if ((instance.addr_abs[0] & 0xFF00) != (hi << 8))
            return 1;
        else
            return 0;
    }

    /**
     * @brief ABY - Absolute with Y Offset Address Mode. 
     * Fundamentally the same as absolute addressing, but the contents of the Y Register is added to the supplied two byte address. 
     * If the resulting address changes the page, an additional clock cycle is required
     * 
     * @return uint8_t flag if an additional clock cycle is needed in this addressing mode
     */
    ABY(instance: R6502) {
        const lo = instance.read(instance.pc[0]);
        instance.pc[0]++;
        const hi = instance.read(instance.pc[0]);
        instance.pc[0]++;

        instance.addr_abs[0] = (hi << 8) | lo;
        instance.addr_abs[0] += instance.y[0];

        if ((instance.addr_abs[0] & 0xFF00) != (hi << 8))
            return 1;
        else
            return 0;
    }

    /**
     * @brief IND - Indirect Address Mode\n
     * The supplied 16-bit address is read to get the actual 16-bit address.
     * 
     * @return uint8_t flag if an additional clock cycle is needed in this addressing mode
     */
    IND(instance: R6502) {
        const ptr_lo = instance.read(instance.pc[0]);
        instance.pc[0]++;
        const ptr_hi = instance.read(instance.pc[0]);
        instance.pc[0]++;

        const ptr = (ptr_hi << 8) | ptr_lo;

        // Simulate page boundary hardware bug
        if (ptr_lo == 0x00FF) {
            instance.addr_abs[0] = (instance.read(ptr & 0xFF00) << 8) | instance.read(ptr + 0);
        }
        else // Behave normally
        {
            instance.addr_abs[0] = (instance.read(ptr + 1) << 8) | instance.read(ptr + 0);
        }
        return 0;
    }

    /**
     * @brief IZX - Indirect X Address Mode\n
     * The supplied 8-bit address is offset by X Register to index
     * a location in page 0x00. The actual 16-bit address is read from this location
     * 
     * @return uint8_t flag if an additional clock cycle is needed in this addressing mode
     */
    IZX(instance: R6502) {
        const t = instance.read(instance.pc[0]);
        instance.pc[0]++;

        const lo = instance.read((t + (instance.x[0])) & 0x00FF);
        const hi = instance.read((t + (instance.x[0] + 1)) & 0x00FF);

        instance.addr_abs[0] = (hi << 8) | lo;

        return 0;
    }

    /**
     * @brief IZY - Indirect Y Address Mode\n
     * The supplied 8-bit address indexes a location in page 0x00. From
     * here the actual 16-bit address is read, and the contents of
     * Y Register is added to it to offset it. If the offset causes a
     * change in page then an additional clock cycle is required.
     * 
     * @return uint8_t flag if an additional clock cycle is needed in this addressing mode
     */
    IZY(instance: R6502) {
        const t = this.read(this.pc[0]);
        this.pc[0]++;

        const lo = this.read(t & 0x00FF);
        const hi = this.read((t + 1) & 0x00FF);

        this.addr_abs[0] = (hi << 8) | lo;
        this.addr_abs[0] += this.y[0];

        if ((this.addr_abs[0] & 0xFF00) != (hi << 8))
            return 1;
        else
            return 0;
    }


    ///////////////// INSTRUTION SET //////////////////////


    /**
     * @brief AND - Bitwise Logic AND\n
     * Function:    A = A & M\n
     * Flags Out:   N, Z
     * 
     * @return uint8_t flag if instruction has potential to require 
     * an additional clock cycle
     */
    AND(instance: R6502) {
        instance.fetch();
        instance.a[0] = instance.a[0] & instance.fetched[0];
        instance.SetFlag(FLAGS6502.Z, instance.a[0] == 0x00);
        instance.SetFlag(FLAGS6502.N, instance.a[0] & 0x80);
        return 1;
    }

    /**
     * @brief ASL - Arithmetic Shift Left\n
     * Function:    A = C <- (A << 1) <- 0\n
     * Flags Out:   N, Z, C
     * 
     * @return uint8_t flag if additional cycle is needed
     */
    ASL(instance: R6502) {
        instance.fetch();
        instance.temp[0] = instance.fetched[0] << 1;
        instance.SetFlag(FLAGS6502.C, (instance.temp[0] & 0xFF00) > 0);
        instance.SetFlag(FLAGS6502.Z, (instance.temp[0] & 0x00FF) == 0x00);
        instance.SetFlag(FLAGS6502.N, instance.temp[0] & 0x80);
        if (instance.lookup[instance.opcode[0]].addrmode == instance.IMP) {
            instance.a[0] = instance.temp[0] & 0x00FF;
        }
        else {
            instance.write(instance.addr_abs[0], instance.temp[0] & 0x00FF);
        }
        return 0;
    }

    /**
     * @brief BCC - Branch if Carry Clear\n
     * Function:    if(C == 0) pc = address
     * 
     * @return uint8_t flag if additional cycle is needed
     */
    BCC(instance: R6502) {
        if (instance.GetFlag(FLAGS6502.C) == 0) {
            instance.cycles++;
            instance.addr_abs[0] = instance.pc[0] + instance.addr_rel[0];

            if ((instance.addr_abs[0] & 0xFF00) != (instance.pc[0] & 0xFF00)) {
                instance.cycles++;
            }
            instance.pc[0] = instance.addr_abs[0];
        }
        return 0;
    }

    /**
     * @brief Branch if Carry Set\n
     * Function:    if(C == 1) pc = address
     * 
     * @return uint8_t flag if additional cycle is needed
     */
    BCS(instance: R6502) {
        if (instance.GetFlag(FLAGS6502.C) == 1) {
            instance.cycles++;
            instance.addr_abs[0] = instance.pc[0] + instance.addr_rel[0];

            if ((instance.addr_abs[0] & 0xFF00) != (instance.pc[0] & 0xFF00)) {
                instance.cycles++;
            }
            instance.pc[0] = instance.addr_abs[0];
        }
        return 0;
    }

    /**
     * @brief BEQ - Branch if Equal\n
     * Function:    if(Z == 1) pc = address
     * 
     * @return uint8_t flag if additional cycle is needed
     */
    BEQ(instance: R6502) {
        if (instance.GetFlag(FLAGS6502.Z) == 1) {
            instance.cycles++;
            instance.addr_abs[0] = instance.pc[0] + instance.addr_rel[0];

            if ((instance.addr_abs[0] & 0xFF00) != (instance.pc[0] & 0xFF00)) {
                instance.cycles++;
            }
            instance.pc[0] = instance.addr_abs[0];
        }
        return 0;
    }

    /**
     * @brief BIT - Bit Test
     * 
     * @return uint8_t flag if additional cycle is needed
     */
    BIT(instance: R6502) {
        instance.fetch();
        instance.temp[0] = instance.a[0] & instance.fetched[0];
        instance.SetFlag(FLAGS6502.Z, (instance.temp[0] & 0x00FF) == 0x00);
        instance.SetFlag(FLAGS6502.N, instance.fetched[0] & (1 << 7));
        instance.SetFlag(FLAGS6502.V, instance.fetched[0] & (1 << 6));
        return 0;
    }

    /**
     * @brief BMI -  Branch if Result Minus\n
     * Function:    if(N == 1) pc = address
     * 
     * @return uint8_t flag if additional cycle is needed
     */
    BMI(instance: R6502) {
        if (instance.GetFlag(FLAGS6502.N) == 1) {
            instance.cycles++;
            instance.addr_abs[0] = instance.pc[0] + instance.addr_rel[0];

            if ((instance.addr_abs[0] & 0xFF00) != (instance.pc[0] & 0xFF00)) {
                instance.cycles++;
            }
            instance.pc[0] = instance.addr_abs[0];
        }
        return 0;
    }

    // Instruction: Branch if Not Equal\n
    // Function:    if(Z == 0) pc = address
    BNE(instance: R6502) {
        if (instance.GetFlag(FLAGS6502.Z) == 0) {
            instance.cycles++;
            instance.addr_abs[0] = instance.pc[0] + instance.addr_rel[0];

            if ((instance.addr_abs[0] & 0xFF00) != (instance.pc[0] & 0xFF00)) {
                instance.cycles++;
            }
            instance.pc[0] = instance.addr_abs[0];
        }
        return 0;
    }

    // Instruction: Branch if Positive\n
    // Function:    if(N == 0) pc = address
    BPL(instance: R6502) {
        if (instance.GetFlag(FLAGS6502.N) == 0) {
            instance.cycles++;
            instance.addr_abs[0] = instance.pc[0] + instance.addr_rel[0];

            if ((instance.addr_abs[0] & 0xFF00) != (instance.pc[0] & 0xFF00)) {
                instance.cycles++;
            }
            instance.pc[0] = instance.addr_abs[0];
        }
        return 0;
    }

    // Instruction: Break\n
    // Function:    Program Sourced Interrupt
    BRK(instance: R6502) {
        instance.pc[0]++;

        instance.SetFlag(FLAGS6502.I, 1);
        instance.write(0x0100 + instance.stkp[0], (instance.pc[0] >> 8) & 0x00FF);
        instance.stkp[0]--;
        instance.write(0x0100 + instance.stkp[0], instance.pc[0] & 0x00FF);
        instance.stkp[0]--;

        instance.SetFlag(FLAGS6502.B, 1);
        instance.write(0x0100 + instance.stkp[0], instance.status[0]);
        instance.stkp[0]--;
        instance.SetFlag(FLAGS6502.B, 0);

        instance.pc[0] = instance.read(0xFFFE) | (instance.read(0xFFFF) << 8);
        return 0;
    }

    // Instruction: Branch if Overflow Clear
    // Function:    if(V == 0) pc = address
    BVC(instance: R6502) {
        if (instance.GetFlag(FLAGS6502.V) == 0) {
            instance.cycles++;
            instance.addr_abs[0] = instance.pc[0] + instance.addr_rel[0];

            if ((instance.addr_abs[0] & 0xFF00) != (instance.pc[0] & 0xFF00)) {
                instance.cycles++;
            }
            instance.pc[0] = instance.addr_abs[0];
        }
        return 0;
    }

    // Instruction: Branch if Overflow Set
    // Function:    if(V == 1) pc = address
    BVS(instance: R6502) {
        if (instance.GetFlag(FLAGS6502.V) == 1) {
            instance.cycles++;
            instance.addr_abs[0] = instance.pc[0] + instance.addr_rel[0];

            if ((instance.addr_abs[0] & 0xFF00) != (instance.pc[0] & 0xFF00))
                instance.cycles++;

            instance.pc[0] = instance.addr_abs[0];
        }
        return 0;
    }

    // Instruction: Clear Carry Flag
    // Function:    C = 0
    CLC(instance: R6502) {
        instance.SetFlag(FLAGS6502.C, false);
        return 0;
    }

    // Instruction: Clear Decimal Flag
    // Function:    D = 0
    CLD(instance: R6502) {
        instance.SetFlag(FLAGS6502.D, false);
        return 0;
    }

    // Instruction: Disable Interrupts / Clear Interrupt Flag
    // Function:    I = 0
    CLI(instance: R6502) {
        instance.SetFlag(FLAGS6502.I, false);
        return 0;
    }

    // Instruction: Clear Overflow Flag
    // Function:    V = 0
    CLV(instance: R6502) {
        instance.SetFlag(FLAGS6502.V, false);
        return 0;
    }

    // Instruction: Compare Accumulator
    // Function:    C <- A >= M      Z <- (A - M) == 0
    // Flags Out:   N, C, Z
    CMP(instance: R6502) {
        instance.fetch();
        instance.temp[0] = instance.a[0] - instance.fetched[0];
        instance.SetFlag(FLAGS6502.C, instance.a[0] >= instance.fetched[0]);
        instance.SetFlag(FLAGS6502.Z, (instance.temp[0] & 0x00FF) == 0x0000);
        instance.SetFlag(FLAGS6502.N, instance.temp[0] & 0x0080);
        return 1;
    }

    // Instruction: Compare X Register
    // Function:    C <- X >= M      Z <- (X - M) == 0
    // Flags Out:   N, C, Z
    CPX(instance: R6502) {
        instance.fetch();
        instance.temp[0] = instance.x[0] - instance.fetched[0];
        instance.SetFlag(FLAGS6502.C, instance.x[0] >= instance.fetched[0]);
        instance.SetFlag(FLAGS6502.Z, (instance.temp[0] & 0x00FF) == 0x0000);
        instance.SetFlag(FLAGS6502.N, instance.temp[0] & 0x0080);
        return 0;
    }

    // Instruction: Compare Y Register
    // Function:    C <- Y >= M      Z <- (Y - M) == 0
    // Flags Out:   N, C, Z
    CPY(instance: R6502) {
        instance.fetch();
        instance.temp[0] = instance.y[0] - instance.fetched[0];
        instance.SetFlag(FLAGS6502.C, instance.y[0] >= instance.fetched[0]);
        instance.SetFlag(FLAGS6502.Z, (instance.temp[0] & 0x00FF) == 0x0000);
        instance.SetFlag(FLAGS6502.N, instance.temp[0] & 0x0080);
        return 0;
    }


    // Instruction: Decrement Value at Memory Location
    // Function:    M = M - 1
    // Flags Out:   N, Z
    DEC(instance: R6502) {
        instance.fetch();
        instance.temp[0] = instance.fetched[0] - 1;
        instance.write(instance.addr_abs[0], instance.temp[0] & 0x00FF);
        instance.SetFlag(FLAGS6502.Z, (instance.temp[0] & 0x00FF) == 0x0000);
        instance.SetFlag(FLAGS6502.N, instance.temp[0] & 0x0080);
        return 0;
    }

    // Instruction: Decrement X Register
    // Function:    X = X - 1
    // Flags Out:   N, Z
    DEX(instance: R6502) {
        instance.x[0]--;
        instance.SetFlag(FLAGS6502.Z, instance.x[0] == 0x00);
        instance.SetFlag(FLAGS6502.N, instance.x[0] & 0x80);
        return 0;
    }

    // Instruction: Decrement Y Register
    // Function:    Y = Y - 1
    // Flags Out:   N, Z
    DEY(instance: R6502) {
        instance.y[0]--;
        instance.SetFlag(FLAGS6502.Z, instance.y[0] == 0x00);
        instance.SetFlag(FLAGS6502.N, instance.y[0] & 0x80);
        return 0;
    }

    // Instruction: Bitwise Logic XOR
    // Function:    A = A xor M
    // Flags Out:   N, Z
    EOR(instance: R6502) {
        instance.fetch();
        instance.a[0] = instance.a[0] ^ instance.fetched[0];
        instance.SetFlag(FLAGS6502.Z, instance.a[0] == 0x00);
        instance.SetFlag(FLAGS6502.N, instance.a[0] & 0x80);
        return 1;
    }

    // Instruction: Increment Value at Memory Location
    // Function:    M = M + 1
    // Flags Out:   N, Z
    INC(instance: R6502) {
        instance.fetch();
        instance.temp[0] = instance.fetched[0] + 1;
        instance.write(instance.addr_abs[0], instance.temp[0] & 0x00FF);
        instance.SetFlag(FLAGS6502.Z, (instance.temp[0] & 0x00FF) == 0x0000);
        instance.SetFlag(FLAGS6502.N, instance.temp[0] & 0x0080);
        return 0;
    }

    // Instruction: Increment X Register
    // Function:    X = X + 1
    // Flags Out:   N, Z
    INX(instance: R6502) {
        instance.x[0]++;
        instance.SetFlag(FLAGS6502.Z, instance.x[0] == 0x00);
        instance.SetFlag(FLAGS6502.N, instance.x[0] & 0x80);
        return 0;
    }

    // Instruction: Increment Y Register
    // Function:    Y = Y + 1
    // Flags Out:   N, Z
    INY(instance: R6502) {
        instance.y[0]++;
        instance.SetFlag(FLAGS6502.Z, instance.y[0] == 0x00);
        instance.SetFlag(FLAGS6502.N, instance.y[0] & 0x80);
        return 0;
    }


    // Instruction: Jump To Location
    // Function:    pc = address
    JMP(instance: R6502) {
        instance.pc[0] = instance.addr_abs[0];
        return 0;
    }

    // Instruction: Jump To Sub-Routine
    // Function:    Push current pc to stack, pc = address
    JSR(instance: R6502) {
        instance.pc[0]--;

        instance.write(0x0100 + instance.stkp[0], (instance.pc[0] >> 8) & 0x00FF);
        instance.stkp[0]--;
        instance.write(0x0100 + instance.stkp[0], instance.pc[0] & 0x00FF);
        instance.stkp[0]--;

        instance.pc[0] = instance.addr_abs[0];
        return 0;
    }

    // Instruction: Load The Accumulator
    // Function:    A = M
    // Flags Out:   N, Z
    LDA(instance: R6502) {
        instance.fetch();
        instance.a[0] = instance.fetched[0];
        instance.SetFlag(FLAGS6502.Z, instance.a[0] == 0x00);
        instance.SetFlag(FLAGS6502.N, instance.a[0] & 0x80);
        return 1;
    }

    // Instruction: Load The X Register
    // Function:    X = M
    // Flags Out:   N, Z
    LDX(instance: R6502) {
        instance.fetch();
        instance.x[0] = instance.fetched[0];
        instance.SetFlag(FLAGS6502.Z, instance.x[0] == 0x00);
        instance.SetFlag(FLAGS6502.N, instance.x[0] & 0x80);
        return 1;
    }

    // Instruction: Load The Y Register
    // Function:    Y = M
    // Flags Out:   N, Z
    LDY(instance: R6502) {
        instance.fetch();
        instance.y[0] = instance.fetched[0];
        instance.SetFlag(FLAGS6502.Z, instance.y[0] == 0x00);
        instance.SetFlag(FLAGS6502.N, instance.y[0] & 0x80);
        return 1;
    }

    LSR(instance: R6502) {
        instance.fetch();
        instance.SetFlag(FLAGS6502.C, instance.fetched[0] & 0x0001);
        instance.temp[0] = instance.fetched[0] >> 1;
        instance.SetFlag(FLAGS6502.Z, (instance.temp[0] & 0x00FF) == 0x0000);
        instance.SetFlag(FLAGS6502.N, instance.temp[0] & 0x0080);
        if (instance.lookup[instance.opcode[0]].addrmode == instance.IMP) {
            instance.a[0] = instance.temp[0] & 0x00FF;
        }
        else {
            instance.write(instance.addr_abs[0], instance.temp[0] & 0x00FF);
        }
        return 0;
    }

    NOP(instance: R6502)
    {
        // Sadly not all NOPs are equal, Ive added a few here
        // based on https://wiki.nesdev.com/w/index.php/CPU_unofficial_opcodes
        // and will add more based on game compatibility, and ultimately
        // I'd like to cover all illegal opcodes too
        switch (instance.opcode[0]) {
            case 0x1C:
            case 0x3C:
            case 0x5C:
            case 0x7C:
            case 0xDC:
            case 0xFC:
                return 1;
        }
        return 0;
    }

    // Instruction: Bitwise Logic OR
    // Function:    A = A | M
    // Flags Out:   N, Z
    ORA(instance: R6502)
    {
        instance.fetch();
        instance.a[0] = instance.a[0] | instance.fetched[0];
        instance.SetFlag(FLAGS6502.Z, instance.a[0] == 0x00);
        instance.SetFlag(FLAGS6502.N, instance.a[0] & 0x80);
        return 1;
    }

    // Instruction: Push Accumulator to Stack
    // Function:    A -> stack
    PHA(instance: R6502)
    {
        instance.write(0x0100 + instance.stkp[0], instance.a[0]);
        instance.stkp[0]--;
        return 0;
    }

    // Instruction: Push Status Register to Stack
    // Function:    status -> stack
    // Note:        Break flag is set to 1 before push
    PHP(instance: R6502)
    {
        instance.write(0x0100 + instance.stkp[0], instance.status[0] | FLAGS6502.B | FLAGS6502.U);
        instance.SetFlag(FLAGS6502.B, 0);
        instance.SetFlag(FLAGS6502.U, 0);
        instance.stkp[0]--;
        return 0;
    }

    // Instruction: Pop Accumulator off Stack
    // Function:    A <- stack
    // Flags Out:   N, Z
    PLA(instance: R6502)
    {
        instance.stkp[0]++;
        instance.a[0] = instance.read(0x0100 + instance.stkp[0]);
        instance.SetFlag(FLAGS6502.Z, instance.a[0] == 0x00);
        instance.SetFlag(FLAGS6502.N, instance.a[0] & 0x80);
        return 0;
    }

    // Instruction: Pop Status Register off Stack
    // Function:    Status <- stack
    PLP(instance: R6502)
    {
        instance.stkp[0]++;
        instance.status[0] = instance.read(0x0100 + instance.stkp[0]);
        instance.SetFlag(FLAGS6502.U, 1);
        return 0;
    }

    ROL(instance: R6502)
    {
        instance.fetch();
        instance.temp[0] = instance.fetched[0] << 1 | instance.GetFlag(FLAGS6502.C);
        instance.SetFlag(FLAGS6502.C, instance.temp[0] & 0xFF00);
        instance.SetFlag(FLAGS6502.Z, (instance.temp[0] & 0x00FF) == 0x0000);
        instance.SetFlag(FLAGS6502.N, instance.temp[0] & 0x0080);
        if (instance.lookup[instance.opcode[0]].addrmode == instance.IMP) {
            instance.a[0] = instance.temp[0] & 0x00FF;
        }
        else {

            instance.write(instance.addr_abs[0], instance.temp[0] & 0x00FF);
        }
        return 0;
    }

    ROR(instance: R6502)
    {
        instance.fetch();
        instance.temp[0] = instance.GetFlag(FLAGS6502.C) << 7 | (instance.fetched[0] >> 1);
        instance.SetFlag(FLAGS6502.C, instance.fetched[0] & 0x01);
        instance.SetFlag(FLAGS6502.Z, (instance.temp[0] & 0x00FF) == 0x00);
        instance.SetFlag(FLAGS6502.N, instance.temp[0] & 0x0080);
        if (instance.lookup[instance.opcode[0]].addrmode == instance.IMP) {
            instance.a[0] = instance.temp[0] & 0x00FF;
        }
        else {
            instance.write(instance.addr_abs[0], instance.temp[0] & 0x00FF);
        }
        return 0;
    }

    RTI(instance: R6502)
    {
        instance.stkp[0]++;
        instance.status[0] = instance.read(0x0100 + instance.stkp[0]);
        instance.status[0] &= ~FLAGS6502.B;
        instance.status[0] &= ~FLAGS6502.U;

        instance.stkp[0]++;
        instance.pc[0] = instance.read(0x0100 + instance.stkp[0]);
        instance.stkp[0]++;
        instance.pc[0] |= instance.read(0x0100 + instance.stkp[0]) << 8;
        return 0;
    }

    RTS(instance: R6502)
    {
        instance.stkp[0]++;
        instance.pc[0] = instance.read(0x0100 + instance.stkp[0]);
        instance.stkp[0]++;
        instance.pc[0] |= instance.read(0x0100 + instance.stkp[0]) << 8;

        instance.pc[0]++;
        return 0;
    }

    // Instruction: Set Carry Flag
    // Function:    C = 1
    SEC(instance: R6502)
    {
        instance.SetFlag(FLAGS6502.C, true);
        return 0;
    }

    // Instruction: Set Decimal Flag
    // Function:    D = 1
    SED(instance: R6502)
    {
        instance.SetFlag(FLAGS6502.D, true);
        return 0;
    }

    // Instruction: Set Interrupt Flag / Enable Interrupts
    // Function:    I = 1
    SEI(instance: R6502)
    {
        instance.SetFlag(FLAGS6502.I, true);
        return 0;
    }

    // Instruction: Store Accumulator at Address
    // Function:    M = A
    STA(instance: R6502)
    {
        instance.write(instance.addr_abs[0], instance.a[0]);
        return 0;
    }

    // Instruction: Store X Register at Address
    // Function:    M = X
    STX(instance: R6502)
    {
        instance.write(instance.addr_abs[0], instance.x[0]);
        return 0;
    }

    // Instruction: Store Y Register at Address
    // Function:    M = Y
    STY(instance: R6502)
    {
        instance.write(instance.addr_abs[0], instance.y[0]);
        return 0;
    }

    // Instruction: Transfer Accumulator to X Register
    // Function:    X = A
    // Flags Out:   N, Z
    TAX(instance: R6502)
    {
        instance.x = instance.a;
        instance.SetFlag(FLAGS6502.Z, instance.x[0] == 0x00);
        instance.SetFlag(FLAGS6502.N, instance.x[0] & 0x80);
        return 0;
    }

    // Instruction: Transfer Accumulator to Y Register
    // Function:    Y = A
    // Flags Out:   N, Z
    TAY(instance: R6502)
    {
        instance.y = instance.a;
        instance.SetFlag(FLAGS6502.Z, instance.y[0] == 0x00);
        instance.SetFlag(FLAGS6502.N, instance.y[0] & 0x80);
        return 0;
    }

    // Instruction: Transfer Stack Pointer to X Register
    // Function:    X = stack pointer
    // Flags Out:   N, Z
    TSX(instance: R6502)
    {
        instance.x[0] = instance.stkp[0];
        instance.SetFlag(FLAGS6502.Z, instance.x[0] == 0x00);
        instance.SetFlag(FLAGS6502.N, instance.x[0] & 0x80);
        return 0;
    }

    // Instruction: Transfer X Register to Accumulator
    // Function:    A = X
    // Flags Out:   N, Z
    TXA(instance: R6502)
    {
        instance.a = instance.x;
        instance.SetFlag(FLAGS6502.Z, instance.a[0] == 0x00);
        instance.SetFlag(FLAGS6502.N, instance.a[0] & 0x80);
        return 0;
    }

    // Instruction: Transfer X Register to Stack Pointer
    // Function:    stack pointer = X
    TXS(instance: R6502)
    {
        instance.stkp[0] = instance.x[0];
        return 0;
    }

    // Instruction: Transfer Y Register to Accumulator
    // Function:    A = Y
    // Flags Out:   N, Z
    TYA(instance: R6502)
    {
        instance.a = instance.y;
        instance.SetFlag(FLAGS6502.Z, instance.a[0] == 0x00);
        this.SetFlag(FLAGS6502.N, this.a[0] & 0x80);
        return 0;
    }

    // This function captures illegal opcodes
    XXX(instance: R6502)
    {
        return 0;
    }

    // Instruction: Add with Carry In
    // Function:    A = A + M + C
    // Flags Out:   C, V, N, Z
    //
    // Explanation:
    // The purpose of this function is to add a value to the accumulator and a carry bit. If
    // the result is > 255 there is an overflow setting the carry bit. Ths allows you to
    // chain together ADC instructions to add numbers larger than 8-bits. This in itself is
    // simple, however the 6502 supports the concepts of Negativity/Positivity and Signed Overflow.
    //
    // 10000100 = 128 + 4 = 132 in normal circumstances, we know this as unsigned and it allows
    // us to represent numbers between 0 and 255 (given 8 bits). The 6502 can also interpret
    // this word as something else if we assume those 8 bits represent the range -128 to +127,
    // i.e. it has become signed.
    //
    // Since 132 > 127, it effectively wraps around, through -128, to -124. This wraparound is
    // called overflow, and this is a useful to know as it indicates that the calculation has
    // gone outside the permissable range, and therefore no longer makes numeric sense.
    //
    // Note the implementation of ADD is the same in binary, this is just about how the numbers
    // are represented, so the word 10000100 can be both -124 and 132 depending upon the
    // context the programming is using it in. We can prove this!
    //
    //  10000100 =  132  or  -124
    // +00010001 = + 17      + 17
    //  ========    ===       ===     See, both are valid additions, but our interpretation of
    //  10010101 =  149  or  -107     the context changes the value, not the hardware!
    //
    // In principle under the -128 to 127 range:
    // 10000000 = -128, 11111111 = -1, 00000000 = 0, 00000000 = +1, 01111111 = +127
    // therefore negative numbers have the most significant set, positive numbers do not
    //
    // To assist us, the 6502 can set the overflow flag, if the result of the addition has
    // wrapped around. V <- ~(A^M) & A^(A+M+C) :D lol, let's work out why!
    //
    // Let's suppose we have A = 30, M = 10 and C = 0
    //          A = 30 = 00011110
    //          M = 10 = 00001010+
    //     RESULT = 40 = 00101000
    //
    // Here we have not gone out of range. The resulting significant bit has not changed.
    // So let's make a truth table to understand when overflow has occurred. Here I take
    // the MSB of each component, where R is RESULT.
    //
    // A  M  R | V | A^R | A^M |~(A^M) |
    // 0  0  0 | 0 |  0  |  0  |   1   |
    // 0  0  1 | 1 |  1  |  0  |   1   |
    // 0  1  0 | 0 |  0  |  1  |   0   |
    // 0  1  1 | 0 |  1  |  1  |   0   |  so V = ~(A^M) & (A^R)
    // 1  0  0 | 0 |  1  |  1  |   0   |
    // 1  0  1 | 0 |  0  |  1  |   0   |
    // 1  1  0 | 1 |  1  |  0  |   1   |
    // 1  1  1 | 0 |  0  |  0  |   1   |
    //
    // We can see how the above equation calculates V, based on A, M and R. V was chosen
    // based on the following hypothesis:
    //       Positive Number + Positive Number = Negative Result -> Overflow
    //       Negative Number + Negative Number = Positive Result -> Overflow
    //       Positive Number + Negative Number = Either Result -> Cannot Overflow
    //       Positive Number + Positive Number = Positive Result -> OK! No Overflow
    //       Negative Number + Negative Number = Negative Result -> OK! NO Overflow
    ADC(instance: R6502)
    {
        // Grab the data that we are adding to the accumulator
        instance.fetch();

        // Add is performed in 16-bit domain for emulation to capture any
        // carry bit, which will exist in bit 8 of the 16-bit word
        instance.temp[0] = instance.a[0] + instance.fetched[0] + instance.GetFlag(FLAGS6502.C);

        // The carry flag out exists in the high byte bit 0
        instance.SetFlag(FLAGS6502.C, instance.temp[0] > 255);

        // The Zero flag is set if the result is 0
        instance.SetFlag(FLAGS6502.Z, (instance.temp[0] & 0x00FF) == 0);

        // The signed Overflow flag is set based on all that up there! :D
        instance.SetFlag(FLAGS6502.V, (~(instance.a[0] ^ instance.fetched[0]) & (instance.a[0] ^ instance.temp[0])) & 0x0080);

        // The negative flag is set to the most significant bit of the result
        instance.SetFlag(FLAGS6502.N, instance.temp[0] & 0x80);

        // Load the result into the accumulator (it's 8-bit dont forget!)
        instance.a[0] = instance.temp[0] & 0x00FF;

        // This instruction has the potential to require an additional clock cycle
        return 1;
    }

    // Instruction: Subtraction with Borrow In
    // Function:    A = A - M - (1 - C)
    // Flags Out:   C, V, N, Z
    //
    // Explanation:
    // Given the explanation for ADC above, we can reorganise our data
    // to use the same computation for addition, for subtraction by multiplying
    // the data by -1, i.e. make it negative
    //
    // A = A - M - (1 - C)  ->  A = A + -1 * (M - (1 - C))  ->  A = A + (-M + 1 + C)
    //
    // To make a signed positive number negative, we can invert the bits and add 1
    // (OK, I lied, a little bit of 1 and 2s complement :P)
    //
    //  5 = 00000101
    // -5 = 11111010 + 00000001 = 11111011 (or 251 in our 0 to 255 range)
    //
    // The range is actually unimportant, because if I take the value 15, and add 251
    // to it, given we wrap around at 256, the result is 10, so it has effectively
    // subtracted 5, which was the original intention. (15 + 251) % 256 = 10
    //
    // Note that the equation above used (1-C), but this got converted to + 1 + C.
    // This means we already have the +1, so all we need to do is invert the bits
    // of M, the data(!) therfore we can simply add, exactly the same way we did
    // before.
    SBC(instance: R6502)
    {
        instance.fetch();

        // Operating in 16-bit domain to capture carry out

        // We can invert the bottom 8 bits with bitwise xor
        const value = (instance.fetched[0]) ^ 0x00FF;

        // Notice this is exactly the same as addition from here!
        instance.temp[0] = instance.a[0] + value + instance.GetFlag(FLAGS6502.C);
        instance.SetFlag(FLAGS6502.C, instance.temp[0] & 0xFF00);
        instance.SetFlag(FLAGS6502.Z, ((instance.temp[0] & 0x00FF) == 0));
        instance.SetFlag(FLAGS6502.V, (instance.temp[0] ^ instance.a[0]) & (instance.temp[0] ^ value) & 0x0080);
        instance.SetFlag(FLAGS6502.N, instance.temp[0] & 0x0080);
        instance.a[0] = instance.temp[0] & 0x00FF;
        return 1;
    }








    



    //////////////////// EXTERNAL INPUTS ///////////////////
    /**
     * @brief Perform one clock cycles worth of emulation
     * 
     */
    clock() {
        // the entire clock computation is performed in one go.
        if (this.cycles == 0) {
            this.opcode[0] = this.read(this.pc[0]);


            // set the unused status flag bit to 1
            this.SetFlag(FLAGS6502.U, true);

            // Increment the program counter
            this.pc[0] += 1;

            // get starting number of clock cycles
            this.cycles = this.lookup[this.opcode[0]].cycles;

            const add_cycle1 = this.lookup[this.opcode[0]].addrmode(this);
            const add_cycle2 = this.lookup[this.opcode[0]].operate(this);

            this.cycles += (add_cycle1 & add_cycle2);

            this.SetFlag(FLAGS6502.U, true);

        }

        // Increment global clock count
        this.clock_count += 1;

        // Decrement number of cycles remaining
        this.cycles -= 1;
    }

    /**
     * @brief Forces the 6502 into a known state. This is hard-wired inside the CPU. 
     * The registers are set to 0x00, the status register is cleared except for unused
     * bit which remains at 1. An absolute address is read from location 0xFFFC
     * which contains a second address that the program counter is set to. 
     */
    reset() {
        // address to set program counter to
        this.addr_abs[0] = this.RESB[0];

        const lo = this.read(this.addr_abs[0]);
        const hi = this.read(this.addr_abs[0] + 1);

        // set program counter
        this.pc[0] = (hi << 8) | lo;
        console.log("Reset Requested. PC = ", this.toHex(this.pc[0]));

        // reset core registers
        this.a[0] = 0;
        this.x[0] = 0;
        this.y[0] = 0;
        this.stkp[0] = 0xFD;
        this.status[0] = 0x00 | FLAGS6502.U;

        // clear all emulation variables
        this.addr_rel[0] = 0x0000;
        this.addr_abs[0] = 0x0000;
        this.fetched[0] = 0x00;

        // Reset takes 8 cycles
        this.cycles = 8;
        this.clock_count = 0;
    }

    /**
     * @brief Interrupt requests are a complex operation and only happen if the
     * "disable interrupt" flag is 0. IRQs can happen at any time, but
     * you dont want them to be destructive to the operation of the running 
     * program. Therefore the current instruction is allowed to finish
     * (which I facilitate by doing the whole thing when cycles == 0) and 
     * then the current program counter is stored on the stack. Then the
     * current status register is stored on the stack. When the routine
     * that services the interrupt has finished, the status register
     * and program counter can be restored to how they where before it 
     * occurred. This is implemented by the "RTI" instruction. Once the IRQ
     * has happened, in a similar way to a reset, a programmable address
     * is read form hard coded location 0xFFFE, which is subsequently
     * set to the program counter. 
     */
    irq() {
        // check if interupts are allowed
        if (this.GetFlag(FLAGS6502.I) == 0) {
            // Push the program counter to the stack. It's 16-bits dont forget so that takes two pushes
            this.write(0x0100 + this.stkp[0], (this.pc[0] >> 8) & 0x00FF);
            this.stkp[0]--;
            this.write(0x0100 + this.stkp[0], this.pc[0] & 0x00FF);
            this.stkp[0]--;

            // Then Push the status register to the stack
            this.SetFlag(FLAGS6502.B, false);
            this.SetFlag(FLAGS6502.U, true);
            this.SetFlag(FLAGS6502.I, true);
            this.write(0x0100 + this.stkp[0], this.status[0]);
            this.stkp[0]--;

            // Read new program counter location from fixed address
            this.addr_abs[0] = this.IRQB[0];
            const lo = this.read(this.addr_abs[0] + 0);
            const hi = this.read(this.addr_abs[0] + 1);
            this.pc[0] = (hi << 8) | lo;

            // IRQs take time
            this.cycles = 7;
        }
    }

    /**
     * @brief A Non-Maskable Interrupt cannot be ignored. 
     * It behaves in exactly the same way as a regular IRQ, 
     * but reads the new program counter address form location NMIB vector.
     */
    nmi() {
        this.write(0x0100 + this.stkp[0], (this.pc[0] >> 8) & 0x00FF);
        this.stkp[0]--;
        this.write(0x0100 + this.stkp[0], this.pc[0] & 0x00FF);
        this.stkp[0]--;

        this.SetFlag(FLAGS6502.B, false);
        this.SetFlag(FLAGS6502.U, true);
        this.SetFlag(FLAGS6502.I, true);
        this.write(0x0100 + this.stkp[0], this.status[0]);
        this.stkp[0]--;

        // set address to NMIB
        this.addr_abs[0] = this.NMIB[0];
        const lo = this.read(this.addr_abs[0] + 0);
        const hi = this.read(this.addr_abs[0] + 1);

        // set program conter location point to NMIB vector location
        this.pc[0] = (hi << 8) | lo;

        this.cycles = 8;
    }

    /**
     * @brief This function sources the data used by the instruction into
     * a convenient numeric variable.\n
     * Some instructions dont have to fetch data as the source is implied by the instruction.
     * 
     * @return uint8_t  the working input value to the ALU
     */
    fetch() {

        if (!(this.lookup[this.opcode[0]].addrmode == this.IMP)) {
            this.fetched[0] = this.read(this.addr_abs[0]);
        }

        return this.fetched[0];
    }

    ///////////////HELPER FUNCTIONS ////////////////

    // Create hex expression function
    toHex(num: number) {
        const hex = num.toString(16).toUpperCase();
        return num <= 0xFF ? `0x${hex}` : `0x${hex}`;
    };

    /**
     * @brief Returns true is the number of cycles left is 0
     * 
     * @return true 
     * @return false 
     */
    complete() {
        return this.cycles == 0;
    }

    // Assembles the 6502 translation table 
    /**
     * @brief This structure and the following vector are used to compile and store
     * the opcode translation table. The 6502 can effectively have 256
     * different instructions. Each of these are stored in a table in numerical
     * order so they can be looked up easily, with no decoding required.
     * Each table entry holds:
     *      Pneumonic : A textual representation of the instruction (used for disassembly)
     *  	Opcode Function: A function pointer to the implementation of the opcode
     *  	Opcode Address Mode : A function pointer to the implementation of the 
     *  						  addressing mechanism used by the instruction
     *  	Cycle Count : An integer that represents the base number of clock cycles the
     *  				  CPU requires to perform the instruction 
     */
    lookup = [
        { name: "BRK", operate: this.BRK, addrmode: this.IMM, cycles: 7 }, { name: "ORA", operate: this.ORA, addrmode: this.IZX, cycles: 6 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 8 }, { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 3 }, { name: "ORA", operate: this.ORA, addrmode: this.ZP0, cycles: 3 }, { name: "ASL", operate: this.ASL, addrmode: this.ZP0, cycles: 5 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 5 }, { name: "PHP", operate: this.PHP, addrmode: this.IMP, cycles: 3 }, { name: "ORA", operate: this.ORA, addrmode: this.IMM, cycles: 2 }, { name: "ASL", operate: this.ASL, addrmode: this.IMP, cycles: 2 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 }, { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 4 }, { name: "ORA", operate: this.ORA, addrmode: this.ABS, cycles: 4 }, { name: "ASL", operate: this.ASL, addrmode: this.ABS, cycles: 6 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 6 },
        { name: "BPL", operate: this.BPL, addrmode: this.REL, cycles: 2 }, { name: "ORA", operate: this.ORA, addrmode: this.IZY, cycles: 5 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 8 }, { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 4 }, { name: "ORA", operate: this.ORA, addrmode: this.ZPX, cycles: 4 }, { name: "ASL", operate: this.ASL, addrmode: this.ZPX, cycles: 6 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 6 }, { name: "CLC", operate: this.CLC, addrmode: this.IMP, cycles: 2 }, { name: "ORA", operate: this.ORA, addrmode: this.ABY, cycles: 4 }, { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 2 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 7 }, { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 4 }, { name: "ORA", operate: this.ORA, addrmode: this.ABX, cycles: 4 }, { name: "ASL", operate: this.ASL, addrmode: this.ABX, cycles: 7 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 7 },
        { name: "JSR", operate: this.JSR, addrmode: this.ABS, cycles: 6 }, { name: "AND", operate: this.AND, addrmode: this.IZX, cycles: 6 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 8 }, { name: "BIT", operate: this.BIT, addrmode: this.ZP0, cycles: 3 }, { name: "AND", operate: this.AND, addrmode: this.ZP0, cycles: 3 }, { name: "ROL", operate: this.ROL, addrmode: this.ZP0, cycles: 5 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 5 }, { name: "PLP", operate: this.PLP, addrmode: this.IMP, cycles: 4 }, { name: "AND", operate: this.AND, addrmode: this.IMM, cycles: 2 }, { name: "ROL", operate: this.ROL, addrmode: this.IMP, cycles: 2 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 }, { name: "BIT", operate: this.BIT, addrmode: this.ABS, cycles: 4 }, { name: "AND", operate: this.AND, addrmode: this.ABS, cycles: 4 }, { name: "ROL", operate: this.ROL, addrmode: this.ABS, cycles: 6 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 6 },
        { name: "BMI", operate: this.BMI, addrmode: this.REL, cycles: 2 }, { name: "AND", operate: this.AND, addrmode: this.IZY, cycles: 5 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 8 }, { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 4 }, { name: "AND", operate: this.AND, addrmode: this.ZPX, cycles: 4 }, { name: "ROL", operate: this.ROL, addrmode: this.ZPX, cycles: 6 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 6 }, { name: "SEC", operate: this.SEC, addrmode: this.IMP, cycles: 2 }, { name: "AND", operate: this.AND, addrmode: this.ABY, cycles: 4 }, { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 2 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 7 }, { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 4 }, { name: "AND", operate: this.AND, addrmode: this.ABX, cycles: 4 }, { name: "ROL", operate: this.ROL, addrmode: this.ABX, cycles: 7 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 7 },
        { name: "RTI", operate: this.RTI, addrmode: this.IMP, cycles: 6 }, { name: "EOR", operate: this.EOR, addrmode: this.IZX, cycles: 6 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 8 }, { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 3 }, { name: "EOR", operate: this.EOR, addrmode: this.ZP0, cycles: 3 }, { name: "LSR", operate: this.LSR, addrmode: this.ZP0, cycles: 5 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 5 }, { name: "PHA", operate: this.PHA, addrmode: this.IMP, cycles: 3 }, { name: "EOR", operate: this.EOR, addrmode: this.IMM, cycles: 2 }, { name: "LSR", operate: this.LSR, addrmode: this.IMP, cycles: 2 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 }, { name: "JMP", operate: this.JMP, addrmode: this.ABS, cycles: 3 }, { name: "EOR", operate: this.EOR, addrmode: this.ABS, cycles: 4 }, { name: "LSR", operate: this.LSR, addrmode: this.ABS, cycles: 6 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 6 },
        { name: "BVC", operate: this.BVC, addrmode: this.REL, cycles: 2 }, { name: "EOR", operate: this.EOR, addrmode: this.IZY, cycles: 5 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 8 }, { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 4 }, { name: "EOR", operate: this.EOR, addrmode: this.ZPX, cycles: 4 }, { name: "LSR", operate: this.LSR, addrmode: this.ZPX, cycles: 6 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 6 }, { name: "CLI", operate: this.CLI, addrmode: this.IMP, cycles: 2 }, { name: "EOR", operate: this.EOR, addrmode: this.ABY, cycles: 4 }, { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 2 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 7 }, { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 4 }, { name: "EOR", operate: this.EOR, addrmode: this.ABX, cycles: 4 }, { name: "LSR", operate: this.LSR, addrmode: this.ABX, cycles: 7 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 7 },
        { name: "RTS", operate: this.RTS, addrmode: this.IMP, cycles: 6 }, { name: "ADC", operate: this.ADC, addrmode: this.IZX, cycles: 6 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 8 }, { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 3 }, { name: "ADC", operate: this.ADC, addrmode: this.ZP0, cycles: 3 }, { name: "ROR", operate: this.ROR, addrmode: this.ZP0, cycles: 5 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 5 }, { name: "PLA", operate: this.PLA, addrmode: this.IMP, cycles: 4 }, { name: "ADC", operate: this.ADC, addrmode: this.IMM, cycles: 2 }, { name: "ROR", operate: this.ROR, addrmode: this.IMP, cycles: 2 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 }, { name: "JMP", operate: this.JMP, addrmode: this.IND, cycles: 5 }, { name: "ADC", operate: this.ADC, addrmode: this.ABS, cycles: 4 }, { name: "ROR", operate: this.ROR, addrmode: this.ABS, cycles: 6 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 6 },
        { name: "BVS", operate: this.BVS, addrmode: this.REL, cycles: 2 }, { name: "ADC", operate: this.ADC, addrmode: this.IZY, cycles: 5 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 8 }, { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 4 }, { name: "ADC", operate: this.ADC, addrmode: this.ZPX, cycles: 4 }, { name: "ROR", operate: this.ROR, addrmode: this.ZPX, cycles: 6 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 6 }, { name: "SEI", operate: this.SEI, addrmode: this.IMP, cycles: 2 }, { name: "ADC", operate: this.ADC, addrmode: this.ABY, cycles: 4 }, { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 2 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 7 }, { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 4 }, { name: "ADC", operate: this.ADC, addrmode: this.ABX, cycles: 4 }, { name: "ROR", operate: this.ROR, addrmode: this.ABX, cycles: 7 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 7 },
        { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 2 }, { name: "STA", operate: this.STA, addrmode: this.IZX, cycles: 6 }, { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 2 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 6 }, { name: "STY", operate: this.STY, addrmode: this.ZP0, cycles: 3 }, { name: "STA", operate: this.STA, addrmode: this.ZP0, cycles: 3 }, { name: "STX", operate: this.STX, addrmode: this.ZP0, cycles: 3 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 3 }, { name: "DEY", operate: this.DEY, addrmode: this.IMP, cycles: 2 }, { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 2 }, { name: "TXA", operate: this.TXA, addrmode: this.IMP, cycles: 2 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 }, { name: "STY", operate: this.STY, addrmode: this.ABS, cycles: 4 }, { name: "STA", operate: this.STA, addrmode: this.ABS, cycles: 4 }, { name: "STX", operate: this.STX, addrmode: this.ABS, cycles: 4 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 4 },
        { name: "BCC", operate: this.BCC, addrmode: this.REL, cycles: 2 }, { name: "STA", operate: this.STA, addrmode: this.IZY, cycles: 6 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 6 }, { name: "STY", operate: this.STY, addrmode: this.ZPX, cycles: 4 }, { name: "STA", operate: this.STA, addrmode: this.ZPX, cycles: 4 }, { name: "STX", operate: this.STX, addrmode: this.ZPY, cycles: 4 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 4 }, { name: "TYA", operate: this.TYA, addrmode: this.IMP, cycles: 2 }, { name: "STA", operate: this.STA, addrmode: this.ABY, cycles: 5 }, { name: "TXS", operate: this.TXS, addrmode: this.IMP, cycles: 2 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 5 }, { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 5 }, { name: "STA", operate: this.STA, addrmode: this.ABX, cycles: 5 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 5 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 5 },
        { name: "LDY", operate: this.LDY, addrmode: this.IMM, cycles: 2 }, { name: "LDA", operate: this.LDA, addrmode: this.IZX, cycles: 6 }, { name: "LDX", operate: this.LDX, addrmode: this.IMM, cycles: 2 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 6 }, { name: "LDY", operate: this.LDY, addrmode: this.ZP0, cycles: 3 }, { name: "LDA", operate: this.LDA, addrmode: this.ZP0, cycles: 3 }, { name: "LDX", operate: this.LDX, addrmode: this.ZP0, cycles: 3 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 3 }, { name: "TAY", operate: this.TAY, addrmode: this.IMP, cycles: 2 }, { name: "LDA", operate: this.LDA, addrmode: this.IMM, cycles: 2 }, { name: "TAX", operate: this.TAX, addrmode: this.IMP, cycles: 2 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 }, { name: "LDY", operate: this.LDY, addrmode: this.ABS, cycles: 4 }, { name: "LDA", operate: this.LDA, addrmode: this.ABS, cycles: 4 }, { name: "LDX", operate: this.LDX, addrmode: this.ABS, cycles: 4 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 4 },
        { name: "BCS", operate: this.BCS, addrmode: this.REL, cycles: 2 }, { name: "LDA", operate: this.LDA, addrmode: this.IZY, cycles: 5 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 5 }, { name: "LDY", operate: this.LDY, addrmode: this.ZPX, cycles: 4 }, { name: "LDA", operate: this.LDA, addrmode: this.ZPX, cycles: 4 }, { name: "LDX", operate: this.LDX, addrmode: this.ZPY, cycles: 4 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 4 }, { name: "CLV", operate: this.CLV, addrmode: this.IMP, cycles: 2 }, { name: "LDA", operate: this.LDA, addrmode: this.ABY, cycles: 4 }, { name: "TSX", operate: this.TSX, addrmode: this.IMP, cycles: 2 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 4 }, { name: "LDY", operate: this.LDY, addrmode: this.ABX, cycles: 4 }, { name: "LDA", operate: this.LDA, addrmode: this.ABX, cycles: 4 }, { name: "LDX", operate: this.LDX, addrmode: this.ABY, cycles: 4 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 4 },
        { name: "CPY", operate: this.CPY, addrmode: this.IMM, cycles: 2 }, { name: "CMP", operate: this.CMP, addrmode: this.IZX, cycles: 6 }, { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 2 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 8 }, { name: "CPY", operate: this.CPY, addrmode: this.ZP0, cycles: 3 }, { name: "CMP", operate: this.CMP, addrmode: this.ZP0, cycles: 3 }, { name: "DEC", operate: this.DEC, addrmode: this.ZP0, cycles: 5 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 5 }, { name: "INY", operate: this.INY, addrmode: this.IMP, cycles: 2 }, { name: "CMP", operate: this.CMP, addrmode: this.IMM, cycles: 2 }, { name: "DEX", operate: this.DEX, addrmode: this.IMP, cycles: 2 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 }, { name: "CPY", operate: this.CPY, addrmode: this.ABS, cycles: 4 }, { name: "CMP", operate: this.CMP, addrmode: this.ABS, cycles: 4 }, { name: "DEC", operate: this.DEC, addrmode: this.ABS, cycles: 6 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 6 },
        { name: "BNE", operate: this.BNE, addrmode: this.REL, cycles: 2 }, { name: "CMP", operate: this.CMP, addrmode: this.IZY, cycles: 5 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 8 }, { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 4 }, { name: "CMP", operate: this.CMP, addrmode: this.ZPX, cycles: 4 }, { name: "DEC", operate: this.DEC, addrmode: this.ZPX, cycles: 6 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 6 }, { name: "CLD", operate: this.CLD, addrmode: this.IMP, cycles: 2 }, { name: "CMP", operate: this.CMP, addrmode: this.ABY, cycles: 4 }, { name: "NOP", operate: this.NOP, addrmode: this.IMP, cycles: 2 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 7 }, { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 4 }, { name: "CMP", operate: this.CMP, addrmode: this.ABX, cycles: 4 }, { name: "DEC", operate: this.DEC, addrmode: this.ABX, cycles: 7 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 7 },
        { name: "CPX", operate: this.CPX, addrmode: this.IMM, cycles: 2 }, { name: "SBC", operate: this.SBC, addrmode: this.IZX, cycles: 6 }, { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 2 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 8 }, { name: "CPX", operate: this.CPX, addrmode: this.ZP0, cycles: 3 }, { name: "SBC", operate: this.SBC, addrmode: this.ZP0, cycles: 3 }, { name: "INC", operate: this.INC, addrmode: this.ZP0, cycles: 5 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 5 }, { name: "INX", operate: this.INX, addrmode: this.IMP, cycles: 2 }, { name: "SBC", operate: this.SBC, addrmode: this.IMM, cycles: 2 }, { name: "NOP", operate: this.NOP, addrmode: this.IMP, cycles: 2 }, { name: "???", operate: this.SBC, addrmode: this.IMP, cycles: 2 }, { name: "CPX", operate: this.CPX, addrmode: this.ABS, cycles: 4 }, { name: "SBC", operate: this.SBC, addrmode: this.ABS, cycles: 4 }, { name: "INC", operate: this.INC, addrmode: this.ABS, cycles: 6 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 6 },
        { name: "BEQ", operate: this.BEQ, addrmode: this.REL, cycles: 2 }, { name: "SBC", operate: this.SBC, addrmode: this.IZY, cycles: 5 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 8 }, { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 4 }, { name: "SBC", operate: this.SBC, addrmode: this.ZPX, cycles: 4 }, { name: "INC", operate: this.INC, addrmode: this.ZPX, cycles: 6 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 6 }, { name: "SED", operate: this.SED, addrmode: this.IMP, cycles: 2 }, { name: "SBC", operate: this.SBC, addrmode: this.ABY, cycles: 4 }, { name: "NOP", operate: this.NOP, addrmode: this.IMP, cycles: 2 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 7 }, { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 4 }, { name: "SBC", operate: this.SBC, addrmode: this.ABX, cycles: 4 }, { name: "INC", operate: this.INC, addrmode: this.ABX, cycles: 7 }, { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 7 }
    ];

    // This is the disassembly function. Its workings are not required for emulation.
    // It is merely a convenience function to turn the binary instruction code into
    // human readable form. Its included as part of the emulator because it can take
    // advantage of many of the CPUs internal operations to do this.
    





}