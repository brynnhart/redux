const isObject = (value) => typeof value === 'object' && value !== null;
export function parseClientMessage(raw) {
    if (!isObject(raw) || typeof raw.type !== 'string') {
        return null;
    }
    if (raw.type === 'key') {
        if (typeof raw.key === 'string' &&
            typeof raw.code === 'string' &&
            typeof raw.ctrl === 'boolean' &&
            typeof raw.alt === 'boolean' &&
            typeof raw.shift === 'boolean') {
            return {
                type: "key",
                key: raw.key,
                code: raw.code,
                ctrl: raw.ctrl,
                alt: raw.alt,
                shift: raw.shift
            };
        }
        return null;
    }
    if (raw.type === 'resize') {
        if (typeof raw.cols === 'number' && typeof raw.rows === 'number') {
            return {
                type: 'resize',
                cols: Math.max(20, Math.floor(raw.cols)),
                rows: Math.max(10, Math.floor(raw.rows))
            };
        }
        return null;
    }
    return null;
}
