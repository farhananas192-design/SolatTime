const { dateAt } = require("./time");
const malaysiaZones = require("./malaysia-zones.json");
const monthNames = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ");
const fields = { fajr: "Fajr", dhuhr: "Dhuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha", syuruk: "Sunrise" };
const cache = new Map();

async function json(url, options = {}) {
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const response = await fetch(url, { ...options, redirect: "error", signal: AbortSignal.timeout(15000) });
            if (!response.ok) throw new Error("Service returned HTTP " + response.status + ". Please try again.");
            return await response.json();
        } catch (error) {
            if (attempt === 1 || !["TypeError", "TimeoutError", "AbortError"].includes(error.name)) throw error;
        }
    }
}

async function cached(key, request) {
    if (!cache.has(key)) {
        const pending = request().catch(error => { cache.delete(key); throw error; });
        cache.set(key, pending);
    }
    return cache.get(key);
}

function text(value, required = true) {
    if (typeof value !== "string" || value.length > 120 || /[\x00-\x1f]/.test(value) || (required && !value.trim())) {
        throw new Error("Choose a valid location.");
    }
    return value.trim();
}

async function countries() {
    return cached("countries", async () => {
        const result = await json("https://countriesnow.space/api/v0.1/countries/states");
        if (result.error || !Array.isArray(result.data)) throw new Error("Country list is unavailable.");
        return result.data.filter(country => typeof country.name === "string" && /^[A-Z]{2}$/.test(country.iso2))
            .map(country => ({
                name: country.name, code: country.iso2,
                states: Array.isArray(country.states) ? country.states.map(state => state.name).filter(Boolean) : []
            }));
    });
}

async function catalog() {
    try {
        return { countries: await countries(), malaysia: malaysiaZones };
    } catch (error) {
        return { countries: [{ name: "Malaysia", code: "MY", states: [] }], malaysia: malaysiaZones,
            warning: "Country directory unavailable. Malaysia is available. Use Retry locations for other countries." };
    }
}

async function cities(country, state) {
    if (country === "Malaysia" && state === "Pulau Pinang") state = "Penang";
    text(country);
    text(state, false);
    const available = (await countries()).find(item => item.name === country);
    if (!available || (state && !available.states.includes(state))) throw new Error("Choose a listed country and state.");
    return cached("cities:" + country + ":" + state, async () => {
        const params = new URLSearchParams({ country, ...(state ? { state } : {}) });
        const result = await json("https://countriesnow.space/api/v0.1/countries/" +
            (state ? "state/cities/q?" : "cities/q?") + params);
        if (result.error || !Array.isArray(result.data)) throw new Error("City directory unavailable. You can type a city name.");
        return result.data.filter(value => typeof value === "string");
    });
}

function normalizeDate(value) {
    if (typeof value !== "string") return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const match = /^(\d{1,2})-([a-z]{3,4}|\d{1,2})-(\d{4})$/i.exec(value);
    if (!match) return "";
    const month = /^\d/.test(match[2]) ? Number(match[2]) : monthNames.indexOf(match[2].slice(0, 3).toLowerCase()) + 1;
    return match[3] + "-" + String(month).padStart(2, "0") + "-" + match[1].padStart(2, "0");
}

async function timetable(zone, period, number) {
    if (!malaysiaZones.some(item => item.code === zone)) throw new Error("Invalid JAKIM zone.");
    let suffix = "";
    if (period === "monthly" && Number.isInteger(number) && number >= 1 && number <= 12) suffix = "/" + number;
    else if (period === "yearly" && Number.isInteger(number) && number >= 2000 && number <= 9999) suffix = "/" + number;
    else if (period !== "daily") throw new Error("Invalid timetable period.");
    return json("https://solat.my/api/" + period + "/" + zone + suffix);
}

function normalize(value) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

async function resolvePlace(selection) {
    const country = text(selection.country);
    const state = text(selection.state, false);
    const city = text(selection.city);
    const item = (await countries()).find(value => value.name === country);
    if (!item || (state && !item.states.includes(state))) throw new Error("Choose a listed country and state.");
    return cached("place:" + JSON.stringify([country, state, city]), async () => {
        const params = new URLSearchParams({
            name: city + (state ? ", " + state : ""), countryCode: item.code, count: "100", language: "en"
        });
        const data = await json("https://geocoding-api.open-meteo.com/v1/search?" + params);
        const matches = (data.results ?? []).filter(place =>
            place.country_code === item.code && normalize(place.name).replace(/ city$/, "") === normalize(city).replace(/ city$/, "") &&
            /^PPL/.test(place.feature_code) && typeof place.timezone === "string");
        if (matches.length === 0) throw new Error("City not found in this country/state. Try another city or spelling.");
        if (matches.length > 1) throw new Error("Several places share this city name. Choose a more specific city.");
        return matches[0];
    });
}

function validateDate(date) {
    if (date !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) {
        throw new Error("Invalid timetable date.");
    }
}

async function day(selection, requestedDate) {
    if (!selection || typeof selection !== "object") throw new Error("Choose a location.");
    validateDate(requestedDate);
    text(selection.city);
    text(selection.state, false);
    if (selection.country === "Malaysia") {
        const zone = text(selection.zone);
        if (!malaysiaZones.some(item => item.code === zone && item.state === selection.state)) {
            throw new Error("Choose the correct JAKIM zone for the selected state.");
        }
        const today = dateAt(Date.now(), "Asia/Kuala_Lumpur");
        const date = requestedDate ?? today;
        const period = date === today ? "daily" : date.slice(0, 4) === today.slice(0, 4) ? "monthly" : "yearly";
        const number = period === "monthly" ? Number(date.slice(5, 7)) : Number(date.slice(0, 4));
        const data = await timetable(zone, period, number);
        const record = Array.isArray(data?.prayerTime) && data.prayerTime.find(value => normalizeDate(value?.date) === date);
        if (!record) throw new Error("No JAKIM timetable is available for " + date + ". Please try again later.");
        const timestamps = {};
        for (const field of Object.keys(fields)) {
            if (!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(record[field] ?? "")) {
                throw new Error("The timetable contains an unavailable prayer time.");
            }
            const clock = record[field].length === 5 ? record[field] + ":00" : record[field];
            timestamps[field] = Date.parse(date + "T" + clock + "+08:00");
        }
        return { ...record, date, timestamps, timeZone: "Asia/Kuala_Lumpur",
            source: "JAKIM data via Solat.my · " + zone };
    }

    const place = await resolvePlace(selection);
    const date = requestedDate ?? dateAt(Date.now(), place.timezone);
    const [year, month, dateNumber] = date.split("-");
    const params = new URLSearchParams({
        latitude: String(place.latitude), longitude: String(place.longitude),
        timezonestring: place.timezone, iso8601: "true"
    });
    const data = await json("https://api.aladhan.com/v1/timings/" + [dateNumber, month, year].join("-") + "?" + params);
    if (data.code !== 200 || !data.data?.timings) throw new Error("No prayer timetable was returned for this city.");
    if (normalizeDate(data.data.date?.gregorian?.date) !== date) throw new Error("The prayer service returned the wrong date.");
    const record = { date, timeZone: place.timezone, timestamps: {},
        source: "AlAdhan · " + (data.data.meta?.method?.name ?? "Regional calculation") +
            " · " + place.name + ", " + (place.admin1 ?? selection.country) };
    for (const [field, key] of Object.entries(fields)) {
        const value = data.data.timings[key];
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(value) ||
            !Number.isFinite(Date.parse(value))) throw new Error("Prayer time unavailable for this date or latitude.");
        record.timestamps[field] = Date.parse(value);
        record[field] = value.slice(11, 19);
    }
    return record;
}

module.exports = { catalog, cities, timetable, day };




