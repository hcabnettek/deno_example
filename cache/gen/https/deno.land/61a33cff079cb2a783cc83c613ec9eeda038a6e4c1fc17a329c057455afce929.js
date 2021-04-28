const objectCloneMemo = new WeakMap();
function cloneArrayBuffer(srcBuffer, srcByteOffset, srcLength, _cloneConstructor) {
    return srcBuffer.slice(srcByteOffset, srcByteOffset + srcLength);
}
function cloneValue(value) {
    switch (typeof value) {
        case "number":
        case "string":
        case "boolean":
        case "undefined":
        case "bigint":
            return value;
        case "object": {
            if (objectCloneMemo.has(value)) {
                return objectCloneMemo.get(value);
            }
            if (value === null) {
                return value;
            }
            if (value instanceof Date) {
                return new Date(value.valueOf());
            }
            if (value instanceof RegExp) {
                return new RegExp(value);
            }
            if (value instanceof SharedArrayBuffer) {
                return value;
            }
            if (value instanceof ArrayBuffer) {
                const cloned = cloneArrayBuffer(value, 0, value.byteLength, ArrayBuffer);
                objectCloneMemo.set(value, cloned);
                return cloned;
            }
            if (ArrayBuffer.isView(value)) {
                const clonedBuffer = cloneValue(value.buffer);
                let length;
                if (value instanceof DataView) {
                    length = value.byteLength;
                }
                else {
                    length = value.length;
                }
                return new value.constructor(clonedBuffer, value.byteOffset, length);
            }
            if (value instanceof Map) {
                const clonedMap = new Map();
                objectCloneMemo.set(value, clonedMap);
                value.forEach((v, k) => {
                    clonedMap.set(cloneValue(k), cloneValue(v));
                });
                return clonedMap;
            }
            if (value instanceof Set) {
                const clonedSet = new Set([...value].map(cloneValue));
                objectCloneMemo.set(value, clonedSet);
                return clonedSet;
            }
            const clonedObj = {};
            objectCloneMemo.set(value, clonedObj);
            const sourceKeys = Object.getOwnPropertyNames(value);
            for (const key of sourceKeys) {
                clonedObj[key] = cloneValue(value[key]);
            }
            Reflect.setPrototypeOf(clonedObj, Reflect.getPrototypeOf(value));
            return clonedObj;
        }
        case "symbol":
        case "function":
        default:
            throw new DOMException("Uncloneable value in stream", "DataCloneError");
    }
}
const { core } = Deno;
export function structuredClone(value) {
    return core ? core.deserialize(core.serialize(value)) : cloneValue(value);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RydWN0dXJlZF9jbG9uZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInN0cnVjdHVyZWRfY2xvbmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBd0NBLE1BQU0sZUFBZSxHQUFHLElBQUksT0FBTyxFQUFFLENBQUM7QUFFdEMsU0FBUyxnQkFBZ0IsQ0FDdkIsU0FBc0IsRUFDdEIsYUFBcUIsRUFDckIsU0FBaUIsRUFFakIsaUJBQXNCO0lBR3RCLE9BQU8sU0FBUyxDQUFDLEtBQUssQ0FDcEIsYUFBYSxFQUNiLGFBQWEsR0FBRyxTQUFTLENBQzFCLENBQUM7QUFDSixDQUFDO0FBS0QsU0FBUyxVQUFVLENBQUMsS0FBVTtJQUM1QixRQUFRLE9BQU8sS0FBSyxFQUFFO1FBQ3BCLEtBQUssUUFBUSxDQUFDO1FBQ2QsS0FBSyxRQUFRLENBQUM7UUFDZCxLQUFLLFNBQVMsQ0FBQztRQUNmLEtBQUssV0FBVyxDQUFDO1FBQ2pCLEtBQUssUUFBUTtZQUNYLE9BQU8sS0FBSyxDQUFDO1FBQ2YsS0FBSyxRQUFRLENBQUMsQ0FBQztZQUNiLElBQUksZUFBZSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRTtnQkFDOUIsT0FBTyxlQUFlLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO2FBQ25DO1lBQ0QsSUFBSSxLQUFLLEtBQUssSUFBSSxFQUFFO2dCQUNsQixPQUFPLEtBQUssQ0FBQzthQUNkO1lBQ0QsSUFBSSxLQUFLLFlBQVksSUFBSSxFQUFFO2dCQUN6QixPQUFPLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO2FBQ2xDO1lBQ0QsSUFBSSxLQUFLLFlBQVksTUFBTSxFQUFFO2dCQUMzQixPQUFPLElBQUksTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO2FBQzFCO1lBQ0QsSUFBSSxLQUFLLFlBQVksaUJBQWlCLEVBQUU7Z0JBQ3RDLE9BQU8sS0FBSyxDQUFDO2FBQ2Q7WUFDRCxJQUFJLEtBQUssWUFBWSxX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