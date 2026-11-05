const searchBtn = document.getElementById("searchBtn");
const prayerTimes = document.getElementById("prayerTimes");
const suggestion = document.getElementById("suggestion");
const countdown = document.getElementById("countdown");
const source = document.getElementById("prayerSource");
const prayerFields = { Subuh: "fajr", Zohor: "dhuhr", Asar: "asr", Maghrib: "maghrib", Isyak: "isha" };
let activeSchedule;

async function getPrayerTimes() {
    let selected;
    try {
        selected = window.SolatLocation.selection();
    } catch (error) {
        prayerTimes.textContent = error.message;
        return;
    }
    clearInterval(activeSchedule?.interval);
    const schedule = { selection: selected, zone: selected.id };
    activeSchedule = schedule;
    prayerTimes.textContent = "Loading prayer times...";
    source.textContent = "";
    countdown.textContent = "Loading countdown...";
    showSavedSuggestion();
    try {
        const record = await window.solat.getDay(selected);
        if (activeSchedule !== schedule) return;
        schedule.date = record.date;
        schedule.timeZone = record.timeZone;
        schedule.sunrise = record.timestamps.syuruk;
        window.SolatTheme.setLocation(schedule.zone, record.timeZone);
        window.SolatTheme.setDaylightTimes(record.date, record.syuruk, record.maghrib, schedule.zone, record.isha, record.timeZone);
        schedule.prayers = Object.entries(prayerFields).map(([name, field]) => ({
            name, time: record[field], timestamp: record.timestamps[field]
        }));
        prayerTimes.replaceChildren();
        for (const { name, time } of schedule.prayers) {
            const row = document.createElement("p");
            row.className = "prayer-card";
            const label = document.createElement("span");
            label.className = "prayer-name";
            label.textContent = name;
            const clock = document.createElement("span");
            clock.className = "prayer-time";
            clock.textContent = time.slice(0, 5);
            row.append(label, clock);
            prayerTimes.appendChild(row);
        }
        source.textContent = selected.city + ", " + selected.country + " · " + record.date + " · " +
            record.timeZone + " · " + record.source;
        window.SolatLocation.remember(selected);
        schedule.interval = setInterval(() => updateCountdown(schedule), 1000);
        updateCountdown(schedule);
    } catch (error) {
        if (activeSchedule !== schedule) return;
        console.error(error);
        prayerTimes.textContent = "Unable to retrieve prayer times. " + error.message;
        countdown.textContent = "Countdown unavailable.";
    }
}

function updateCountdown(schedule) {
    const now = Date.now();
    if (schedule.date !== SolatTime.dateAt(now, schedule.timeZone)) {
        getPrayerTimes();
        return;
    }
    const next = schedule.prayers.find(prayer => prayer.timestamp > now);
    const currentPrayer = schedule.prayers.findLast(prayer => prayer.timestamp <= now);
    let period = currentPrayer?.name ?? "beforeSubuh";
    if (period === "Subuh" && now >= schedule.sunrise) period = "morning";
    showSuggestion(schedule, period);
    if (next) {
        renderCountdown(next.name, next.timestamp - now);
        return;
    }
    if (!schedule.tomorrowRequest) schedule.tomorrowRequest = loadTomorrow(schedule);
    if (schedule.tomorrowSubuh) {
        renderCountdown("Subuh (tomorrow)", schedule.tomorrowSubuh - now);
    } else {
        countdown.textContent = schedule.tomorrowFailed
            ? "Tomorrow's Subuh time is unavailable. Use Get Prayer Times to retry."
            : "Loading tomorrow's Subuh time...";
    }
}

async function loadTomorrow(schedule) {
    try {
        const record = await window.solat.getDay(schedule.selection, SolatTime.nextDate(schedule.date));
        schedule.tomorrowSubuh = record.timestamps.fajr;
    } catch (error) {
        console.error(error);
        schedule.tomorrowFailed = true;
    }
    if (activeSchedule === schedule) updateCountdown(schedule);
}

function renderCountdown(name, milliseconds) {
    const seconds = Math.ceil(milliseconds / 1000);
    const prayer = document.createElement("span");
    prayer.className = "countdown-prayer";
    prayer.textContent = name;
    const clock = document.createElement("span");
    clock.className = "countdown-time";
    clock.textContent = String(Math.floor(seconds / 3600)).padStart(2, "0") + "h " +
        String(Math.floor(seconds / 60) % 60).padStart(2, "0") + "m " +
        String(seconds % 60).padStart(2, "0") + "s";
    countdown.replaceChildren(prayer, clock);
}

function showSuggestion(schedule, period) {
    // The period is the prayer time currently active, with separate before-Subuh and morning periods.
    let activity;
    switch (period) {
        case "beforeSubuh":
            activity = "Before Subuh. Rest, make doa, or prepare for Subuh.";
            break;
        case "Subuh":
            activity = "Subuh time. Perform Subuh if you have not prayed, then read Al-Quran.";
            break;
        case "morning":
            activity = "After sunrise. Perform morning zikir, read Al-Quran, or continue daily activities.";
            break;
        case "Zohor":
            activity = "Zohor time. Perform Zohor if you have not prayed, then continue daily activities.";
            break;
        case "Asar":
            activity = "Asar time. Perform Asar if you have not prayed, then spend time in zikir.";
            break;
        case "Maghrib":
            activity = "Maghrib time. Perform Maghrib if you have not prayed, then read Al-Quran.";
            break;
        case "Isyak":
            activity = "Isyak time. Perform Isyak if you have not prayed, then make doa and prepare for rest.";
            break;
        default:
            activity = "No activity suggestion is available. Retrieve valid prayer times and try again.";
    }
    if (schedule.suggestionPeriod === period && suggestion.textContent === activity) return;
    schedule.suggestionPeriod = period;
    suggestion.textContent = activity;
    try {
        localStorage.setItem("lastSuggestion", JSON.stringify({
            activity, zone: schedule.zone, savedAt: new Date().toISOString()
        }));
    } catch (error) {
        console.warn("Unable to save activity suggestion:", error);
    }
}

function showSavedSuggestion() {
    suggestion.textContent = "Activity suggestions will appear here.";
    try {
        const selected = window.SolatLocation.selection();
        const record = JSON.parse(localStorage.getItem("lastSuggestion"));
        if (typeof record?.activity === "string" && record.activity.trim() && record.zone === selected.id) {
            suggestion.textContent = "Last saved suggestion: " + record.activity;
        }
    } catch (error) {
        console.warn("Unable to read saved activity suggestion:", error);
    }
}

searchBtn.addEventListener("click", getPrayerTimes);
document.addEventListener("solat-recent-ready", getPrayerTimes);
document.addEventListener("solat-location-change", () => {
    clearInterval(activeSchedule?.interval);
    activeSchedule = null;
    prayerTimes.textContent = "Use Get Prayer Times for the selected location.";
    source.textContent = "";
    countdown.textContent = "Countdown will appear here.";
    suggestion.textContent = "Activity suggestions will appear here.";
});
window.SolatLocation.ready.then(showSavedSuggestion);



