(() => {
    const country = document.getElementById("country");
    const state = document.getElementById("state");
    const city = document.getElementById("city");
    const otherCity = document.getElementById("otherCity");
    const otherCityField = document.getElementById("otherCityField");
    const zone = document.getElementById("location");
    const zoneField = document.getElementById("zoneField");
    const status = document.getElementById("locationStatus");
    let catalog;
    let towns = [];
    let cityRequest = 0;
    const recentSelect = document.getElementById("recentLocations");
    let recent = [];
    try {
        const saved = JSON.parse(localStorage.getItem("recentLocations"));
        if (Array.isArray(saved)) {
            recent = saved.filter(item => typeof item?.country === "string" &&
                typeof item.state === "string" && typeof item.city === "string" &&
                item.city.trim() && typeof item.zone === "string").slice(0, 8);
        }
    } catch (error) {
        console.warn("Unable to restore recent locations:", error);
    }

    function renderRecent() {
        options(recentSelect, [["", recent.length ? "Choose a recent location" : "No recent locations yet"],
            ...recent.map((item, index) => [String(index), [item.city, item.state, item.country].filter(Boolean).join(" · ")])]);
        recentSelect.disabled = recent.length === 0 || !catalog;
    }

    function remember(selected) {
        recent = [selected, ...recent.filter(item =>
            JSON.stringify([item.country, item.state, item.city.toLowerCase(), item.zone]) !==
            JSON.stringify([selected.country, selected.state, selected.city.toLowerCase(), selected.zone]))].slice(0, 8);
        try {
            localStorage.setItem("selectedLocation", JSON.stringify(selected));
            localStorage.setItem("recentLocations", JSON.stringify(recent));
        } catch (error) {
            console.warn("Unable to save recent locations:", error);
        }
        renderRecent();
    }

    function options(select, entries) {
        select.replaceChildren();
        for (const [value, label] of entries) {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = label;
            select.appendChild(option);
        }
    }

    function changed() {
        savePreference();
        document.dispatchEvent(new Event("solat-location-change"));
    }

    function matchesTown() {
        return towns.find(item => item.location.toLowerCase() === cityName().toLowerCase());
    }

    function syncZone() {
        if (country.value !== "Malaysia") return;
        zone.value = matchesTown()?.code ?? "";
    }

    function savePreference() {
        if (!catalog) return;
        try {
            localStorage.setItem("locationPreference", JSON.stringify({
                country: country.value, state: state.value, city: cityName(),
                zone: country.value === "Malaysia" ? zone.value : ""
            }));
        } catch (error) {
            console.warn("Unable to save location preference:", error);
        }
    }

    function cityName() {
        return (city.value === "__other__" ? otherCity.value : city.value).trim();
    }

    function showCities(names, preferred) {
        const unique = [...new Set(names)].sort((a, b) => a.localeCompare(b));
        options(city, [["", "Choose a city / town"],
            ...unique.map(name => [name, name]), ["__other__", "Other city / town..."]]);
        if (preferred && unique.includes(preferred)) city.value = preferred;
        else if (preferred) {
            city.value = "__other__";
            otherCity.value = preferred;
        } else city.value = "";
        otherCityField.hidden = city.value !== "__other__";
        if (city.value !== "__other__") otherCity.value = "";
    }

    async function loadCities(preferredCity = "") {
        const request = ++cityRequest;
        const isMalaysia = country.value === "Malaysia";
        towns = isMalaysia ? catalog.malaysia.filter(item => item.state === state.value) : [];
        if (isMalaysia && state.value === "Selangor") {
            towns = [...towns, { state: "Selangor", location: "Beranang", code: "SGR01" }];
        }
        if (isMalaysia) {
            const grouped = new Map();
            for (const item of towns) {
                if (!grouped.has(item.code)) grouped.set(item.code, []);
                grouped.get(item.code).push(item.location);
            }
            options(zone, [["", "Choose prayer zone"],
                ...Array.from(grouped, ([code, names]) => [code, code + " · " + names.join(", ")])]);
        }
        showCities(towns.map(town => town.location), preferredCity || (isMalaysia ? towns[0]?.location : ""));
        syncZone();
        savePreference();
        status.textContent = "Loading cities for this state...";
        try {
            const values = await window.solat.getCities(country.value, state.value);
            if (request !== cityRequest) return;
            const current = cityName();
            showCities([...towns.map(town => town.location), ...values], current);
            status.textContent = isMalaysia
                ? "Choose a city. If its JAKIM zone is not filled in, select the correct zone."
                : "Choose a city, or use Other city / town if it is missing.";
        } catch (error) {
            if (request !== cityRequest) return;
            status.textContent = isMalaysia
                ? "Showing JAKIM areas. Extra city directory unavailable. You can use Other city / town."
                : "City directory unavailable. Use Other city / town to enter a city.";
            console.warn(error);
        }
    }
    async function loadStates(preferredState, preferredCity) {
        const isMalaysia = country.value === "Malaysia";
        zoneField.hidden = !isMalaysia;
        const entry = catalog.countries.find(item => item.name === country.value);
        const states = isMalaysia ? [...new Set(catalog.malaysia.map(item => item.state))] : entry?.states ?? [];
        options(state, [
            ...(!isMalaysia ? [["", "All states / regions"]] : []),
            ...states.sort((a, b) => a.localeCompare(b)).map(value => [value, value])
        ]);
        if (states.includes(preferredState)) state.value = preferredState;
        await loadCities(preferredCity);
    }

    function selection() {
        const selected = {
            country: country.value, state: state.value, city: cityName(),
            zone: country.value === "Malaysia" ? zone.value : ""
        };
        if (!selected.country || !selected.city || (selected.country === "Malaysia" && (!selected.state || !selected.zone))) {
            throw new Error("Choose a country and city, and the JAKIM zone for Malaysia.");
        }
        selected.id = selected.country === "Malaysia" ? selected.zone :
            JSON.stringify([selected.country, selected.state, selected.city.toLowerCase()]);
        return selected;
    }

    async function init() {
        document.getElementById("searchBtn").disabled = true;
        country.disabled = state.disabled = city.disabled = zone.disabled = true;
        status.textContent = "Loading countries and regions...";
        try {
            catalog = await window.solat.getCatalog();
            let saved = { country: "Malaysia", state: "Kuala Lumpur", city: "Kuala Lumpur" };
            try {
                const stored = JSON.parse(localStorage.getItem("locationPreference") ?? localStorage.getItem("selectedLocation"));
                if (stored?.country && typeof stored.city === "string") saved = stored;
                else {
                    const previous = JSON.parse(localStorage.getItem("lastSuggestion"));
                    const town = catalog.malaysia.find(item => item.code === previous?.zone);
                    if (town) saved = { country: "Malaysia", state: town.state, city: town.location };
                }
            } catch (error) {
                console.warn("Unable to restore location:", error);
            }
            if (!catalog.countries.some(item => item.name === saved.country)) {
                if (catalog.warning) {
                    catalog.countries.push({ name: saved.country, states: saved.state ? [saved.state] : [] });
                } else {
                    saved = { country: "Malaysia", state: "Kuala Lumpur", city: "Kuala Lumpur" };
                }
            }
            options(country, catalog.countries.slice().sort((a, b) => a.name.localeCompare(b.name)).map(item => [item.name, item.name]));
            country.value = saved.country;
            await loadStates(saved.state, saved.city);
            if (saved.country === "Malaysia" && Array.from(zone.options).some(option => option.value === saved.zone)) {
                zone.value = saved.zone;
                savePreference();
            }
        } catch (error) {
            status.textContent = "Locations could not be loaded. Use Retry locations.";
            console.error(error);
        } finally {
            country.disabled = state.disabled = city.disabled = zone.disabled = false;
            document.getElementById("searchBtn").disabled = !catalog;
            renderRecent();
        }
    }

    country.addEventListener("change", () => { changed(); loadStates(); });
    state.addEventListener("change", () => { changed(); loadCities(); });
    city.addEventListener("change", () => {
        otherCityField.hidden = city.value !== "__other__";
        otherCity.value = "";
        syncZone();
        changed();
    });
    otherCity.addEventListener("input", () => { syncZone(); changed(); });
    zone.addEventListener("change", changed);
    document.getElementById("retryLocations").addEventListener("click", () => { changed(); init(); });
    recentSelect.addEventListener("change", async () => {
        const item = recent[Number(recentSelect.value)];
        if (recentSelect.value === "" || !item) return;
        if (!catalog.countries.some(entry => entry.name === item.country)) {
            status.textContent = "This country is currently unavailable. Use Retry locations.";
            return;
        }
        changed();
        country.value = item.country;
        await loadStates(item.state, item.city);
        if (country.value !== item.country || state.value !== item.state || cityName() !== item.city) return;
        if (item.country === "Malaysia") zone.value = item.zone;
        savePreference();
        document.dispatchEvent(new Event("solat-recent-ready"));
    });

    renderRecent();
    window.SolatLocation = { selection, remember, ready: init() };
})();




