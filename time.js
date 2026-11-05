const formatters = new Map();

function partsAt(timestamp, timeZone) {
    if (!formatters.has(timeZone)) {
        formatters.set(timeZone, new Intl.DateTimeFormat("en-GB", {
            timeZone, year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
        }));
    }
    return Object.fromEntries(formatters.get(timeZone).formatToParts(new Date(timestamp))
        .filter(part => part.type !== "literal").map(part => [part.type, part.value]));
}

function dateAt(timestamp, timeZone) {
    const parts = partsAt(timestamp, timeZone);
    return parts.year + "-" + parts.month + "-" + parts.day;
}

function nextDate(date) {
    return new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10);
}

if (typeof module !== "undefined") module.exports = { partsAt, dateAt, nextDate };
else window.SolatTime = { partsAt, dateAt, nextDate };
