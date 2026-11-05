(() => {
    let timeZone = "Asia/Kuala_Lumpur";
    let zone = "WLY01";
    let daylight;
    let simulationStartedAt = null;

    try {
        const saved = Number(sessionStorage.getItem("skySimulationStartedAt"));
        if (saved > 0 && Number.isFinite(saved)) simulationStartedAt = saved;
    } catch (error) {
        console.warn("Unable to restore sky simulation:", error);
    }

    try {
        const suggestion = JSON.parse(localStorage.getItem("lastSuggestion"));
        if (typeof suggestion?.zone === "string") zone = suggestion.zone;
        daylight = JSON.parse(localStorage.getItem("daylightTimes"));
        if (daylight?.zone === zone && typeof daylight.timeZone === "string") {
            try {
                SolatTime.partsAt(Date.now(), daylight.timeZone);
                timeZone = daylight.timeZone;
            } catch (error) {
                console.warn("Invalid saved time zone:", error);
            }
        }
    } catch (error) {
        console.warn("Unable to restore daylight settings:", error);
    }

    function minutes(time) {
        if (typeof time !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)) return NaN;
        const [hours, mins, seconds = "0"] = time.split(":").map(Number);
        return hours * 60 + mins + Number(seconds) / 60;
    }

    function updateTheme() {
        const now = SolatTime.partsAt(Date.now(), timeZone);
        const date = now.year + "-" + now.month + "-" + now.day;
        const simulated = simulationStartedAt !== null;
        const elapsed = Math.max(0, Date.now() - simulationStartedAt);
        // One real second advances twelve simulated minutes. Repeat today's sky.
        const clockMilliseconds = simulated
            ? (6 * 3600000 + elapsed * 720) % 86400000
            : Number(now.hour) * 3600000 + Number(now.minute) * 60000 + Number(now.second) * 1000;
        const current = clockMilliseconds / 60000;
        document.documentElement.dataset.clockMode = simulated ? "simulation" : "realtime";
        const clock = document.getElementById("headerClock");
        if (clock) {
            const hours = Math.floor(clockMilliseconds / 3600000);
            const mins = Math.floor(clockMilliseconds / 60000) % 60;
            const seconds = Math.floor(clockMilliseconds / 1000) % 60;
            clock.textContent = [hours, mins, seconds].map(value => String(value).padStart(2, "0")).join(":");
            document.getElementById("clockLabel").textContent = simulated ? "Simulation time" : timeZone === "Asia/Kuala_Lumpur" ? "Malaysia time" : timeZone.replace(/_/g, " ");
        }
        let sunrise = 7 * 60;
        let sunset = 19 * 60;
        let isyak = 20 * 60 + 15;
        if (daylight?.date === date && daylight.zone === zone &&
            Number.isFinite(daylight.sunrise) && Number.isFinite(daylight.sunset) &&
            daylight.sunrise >= 0 && daylight.sunset <= 1440 && daylight.sunrise < daylight.sunset) {
            sunrise = daylight.sunrise;
            sunset = daylight.sunset;
            if (Number.isFinite(daylight.isyak) && daylight.isyak > sunset && daylight.isyak < 1440) {
                isyak = daylight.isyak;
            }
        }

        const isDay = current >= sunrise && current < sunset;
        let theme = "night";
        if (isDay) theme = "day";
        else if (current >= sunset && current < isyak) theme = "twilight";
        document.documentElement.dataset.theme = theme;
        // Real-time progress keeps the same sky when reopening either page.
        const eveningProgress = Math.max(0, Math.min(1, (current - sunset) / (isyak - sunset)));
        const dawnProgress = Math.max(0, Math.min(1, (current - (sunrise - 45)) / 45));
        const beforeSunrise = current < sunrise;
        const nightOpacity = beforeSunrise ? 1 - dawnProgress :
            theme === "twilight" ? eveningProgress : theme === "night" ? 1 : 0;
        const nightLength = 1440 - sunset + sunrise;
        const minutesIntoNight = (current - sunset + 1440) % 1440;
        const moonProgress = Math.max(0, Math.min(1, minutesIntoNight / nightLength));
        document.documentElement.style.setProperty("--moon-progress", moonProgress);
        const solarProgress = (current - sunrise) / (sunset - sunrise);
        const solarGlow = beforeSunrise ? dawnProgress :
            current <= sunset ? 1 : Math.max(0, 1 - (current - sunset) / 45);
        document.documentElement.style.setProperty("--solar-progress", solarProgress);
        document.documentElement.style.setProperty("--solar-glow", solarGlow);
        document.documentElement.style.setProperty("--solar-strength",
            isDay ? Math.pow(Math.max(0, Math.sin(Math.PI * solarProgress)), .4) : 0);
        document.documentElement.style.setProperty("--night-opacity", nightOpacity);
        document.documentElement.style.setProperty("--blue-opacity",
            theme === "twilight" ? 0.65 * (1 - eveningProgress) : 0);
        const progress = Math.max(0, Math.min(1, (current - sunrise) / (sunset - sunrise)));
        // A simple arc shows progress through daylight hours.
        document.documentElement.style.setProperty("--sun-x", (12 + progress * 76) + "%");
        document.documentElement.style.setProperty("--sun-y", (102 - Math.sin(progress * Math.PI) * 90) + "%");
    }

    window.SolatTheme = {
        setLocation(selectedZone, selectedTimeZone = "Asia/Kuala_Lumpur") {
            zone = selectedZone;
            timeZone = selectedTimeZone;
            updateTheme();
        },
        setDaylightTimes(date, sunriseTime, sunsetTime, selectedZone, isyakTime, selectedTimeZone = "Asia/Kuala_Lumpur") {
            const sunrise = minutes(sunriseTime);
            const sunset = minutes(sunsetTime);
            if (!Number.isFinite(sunrise) || !Number.isFinite(sunset) || sunrise >= sunset) return;
            daylight = { date, zone: selectedZone, sunrise, sunset, isyak: minutes(isyakTime), timeZone: selectedTimeZone };
            timeZone = selectedTimeZone;
            zone = selectedZone;
            try {
                localStorage.setItem("daylightTimes", JSON.stringify(daylight));
            } catch (error) {
                console.warn("Unable to save daylight times:", error);
            }
            updateTheme();
        }
    };

    function setMode(simulated) {
        simulationStartedAt = simulated ? Date.now() : null;
        try {
            if (simulated) sessionStorage.setItem("skySimulationStartedAt", String(simulationStartedAt));
            else sessionStorage.removeItem("skySimulationStartedAt");
        } catch (error) {
            console.warn("Unable to save sky simulation:", error);
        }
        updateControls();
        updateTheme();
    }

    function updateControls() {
        const simulated = simulationStartedAt !== null;
        document.getElementById("realTimeBtn").setAttribute("aria-pressed", String(!simulated));
        document.getElementById("simulationBtn").setAttribute("aria-pressed", String(simulated));
        document.getElementById("skyModeHint").textContent = simulated
            ? "Sky preview: 5 seconds = 1 hour. Prayer times use the selected city's real time."
            : "Sky follows the loaded location's local time.";
    }

    document.addEventListener("DOMContentLoaded", () => {
        document.getElementById("realTimeBtn").addEventListener("click", () => setMode(false));
        document.getElementById("simulationBtn").addEventListener("click", () => setMode(true));
        updateControls();
        updateTheme();
    });

    updateTheme();
    setInterval(updateTheme, 100);
    document.addEventListener("visibilitychange", updateTheme);
})();






