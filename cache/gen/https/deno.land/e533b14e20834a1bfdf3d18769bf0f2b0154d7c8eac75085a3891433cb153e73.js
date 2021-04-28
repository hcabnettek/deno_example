import { copyBytes } from "./deps.ts";
export class AsyncIterableReader {
    #asyncIterator;
    #closed = false;
    #current;
    #processValue;
    constructor(asyncIterable, processValue) {
        this.#asyncIterator = asyncIterable[Symbol.asyncIterator]();
        this.#processValue = processValue;
    }
    #close = () => {
        if (this.#asyncIterator.return) {
            this.#asyncIterator.return();
        }
        this.#asyncIterator = undefined;
        this.#closed = true;
    };
    async read(p) {
        if (this.#closed) {
            return null;
        }
        if (p.byteLength === 0) {
            this.#close();
            return 0;
        }
        if (!this.#current) {
            const { value, done } = await this.#asyncIterator.next();
            if (done) {
                this.#close();
            }
            if (value !== undefined) {
                this.#current = this.#processValue(value);
            }
        }
        if (!this.#current) {
            if (!this.#closed) {
                this.#close();
            }
            return null;
        }
        const len = copyBytes(this.#current, p);
        if (len >= this.#current.byteLength) {
            this.#current = undefined;
        }
        else {
            this.#current = this.#current.slice(len);
        }
        return len;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXN5bmNfaXRlcmFibGVfcmVhZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXN5bmNfaXRlcmFibGVfcmVhZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUVBLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFFdEMsTUFBTSxPQUFPLG1CQUFtQjtJQUM5QixjQUFjLENBQW1CO0lBQ2pDLE9BQU8sR0FBRyxLQUFLLENBQUM7SUFDaEIsUUFBUSxDQUF5QjtJQUNqQyxhQUFhLENBQTJCO0lBRXhDLFlBQ0UsYUFBK0IsRUFDL0IsWUFBc0M7UUFFdEMsSUFBSSxDQUFDLGNBQWMsR0FBRyxhQUFhLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUM7UUFDNUQsSUFBSSxDQUFDLGFBQWEsR0FBRyxZQUFZLENBQUM7SUFDcEMsQ0FBQztJQUVELE1BQU0sR0FBRyxHQUFHLEVBQUU7UUFDWixJQUFJLElBQUksQ0FBQyxjQUFjLENBQUMsTUFBTSxFQUFFO1lBQzlCLElBQUksQ0FBQyxjQUFjLENBQUMsTUFBTSxFQUFFLENBQUM7U0FDOUI7UUFFQSxJQUFZLENBQUMsY0FBYyxHQUFHLFNBQVMsQ0FBQztRQUN6QyxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztJQUN0QixDQUFDLENBQUM7SUFFRixLQUFLLENBQUMsSUFBSSxDQUFDLENBQWE7UUFDdEIsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO1lBQ2hCLE9BQU8sSUFBSSxDQUFDO1NBQ2I7UUFDRCxJQUFJLENBQUMsQ0FBQyxVQUFVLEtBQUssQ0FBQyxFQUFFO1lBQ3RCLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNkLE9BQU8sQ0FBQyxDQUFDO1NBQ1Y7UUFDRCxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRTtZQUNsQixNQUFNLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxHQUFHLE1BQU0sSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUN6RCxJQUFJLElBQUksRUFBRTtnQkFDUixJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7YUFDZjtZQUNELElBQUksS0FBSyxLQUFLLFNBQVMsRUFBRTtnQkFDdkIsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO2FBQzNDO1NBQ0Y7UUFDRCxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRTtZQUNsQixJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRTtnQkFDakIsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO2FBQ2Y7WUFDRCxPQUFPLElBQUksQ0FBQztTQUNiO1FBQ0QsTUFBTSxHQUFHLEdBQUcsU0FBUyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDeEMsSUFBSSxHQUFHLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUU7WUFDbkMsSUFBSSxDQUFDLFFBQVEsR0FBRyxTQUFTLENBQUM7U0FDM0I7YUFBTTtZQUNMLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7U0FDMUM7UUFDRCxPQUFPLEdBQUcsQ0FBQztJQUNiLENBQUM7Q0FDRiJ9