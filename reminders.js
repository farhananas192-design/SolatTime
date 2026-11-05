const activity = document.getElementById("activity");
const customActivity = document.getElementById("customActivity");
const reminderTime = document.getElementById("reminderTime");
const scheduleType = document.getElementById("scheduleType");
const scheduleDate = document.getElementById("scheduleDate");
const weekday = document.getElementById("weekday");
const monthDay = document.getElementById("monthDay");
const addBtn = document.getElementById("addBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const reminderList = document.getElementById("reminderList");
const message = document.getElementById("message");
const validActivities = new Set(Array.from(activity.options, option => option.value)
    .filter(value => value && value !== "__custom__"));
const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const scheduleHints = {
    daily: "Every day at the selected time.",
    day: "Once on the selected calendar date.",
    week: "Every day within the selected week, at the selected time.",
    month: "Every day within the selected month, at the selected time.",
    weekly: "Every week on the chosen weekday, at the selected time.",
    monthly: "Every month on the chosen date. Months without that date are skipped."
};
let editIndex = -1;
let reminders = loadReminders();

function validSchedule(schedule) {
    if (!schedule || !Object.hasOwn(scheduleHints, schedule.type)) return false;
    if (schedule.type === "daily") return true;
    if (!["string", "number"].includes(typeof schedule.value)) return false;
    if (schedule.type === "weekly") return /^[0-6]$/.test(String(schedule.value));
    if (schedule.type === "monthly") {
        return Number.isInteger(Number(schedule.value)) && Number(schedule.value) >= 1 && Number(schedule.value) <= 31;
    }
    if (typeof schedule.value !== "string" || !schedule.value) return false;
    const input = document.createElement("input");
    input.type = schedule.type === "day" ? "date" : schedule.type;
    input.value = schedule.value;
    return input.value === schedule.value && input.validity.valid;
}

function loadReminders() {
    try {
        const saved = JSON.parse(localStorage.getItem("reminders") ?? "[]");
        if (!Array.isArray(saved)) throw new Error("Expected a reminder list");
        const valid = [];
        for (const reminder of saved) {
            const schedule = reminder?.schedule ?? { type: "daily", value: "" };
            const textValid = typeof reminder?.activity === "string" && reminder.activity.trim() &&
                reminder.activity.length <= 120;
            if (textValid && (reminder.custom === true || validActivities.has(reminder.activity)) &&
                typeof reminder.time === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(reminder.time) &&
                validSchedule(schedule)) {
                valid.push({ ...reminder, activity: reminder.activity.trim(), schedule });
            }
        }
        if (valid.length !== saved.length) message.textContent = "Some saved reminders could not be read.";
        return valid;
    } catch (error) {
        message.textContent = "Saved reminders could not be read.";
        console.warn(error);
        return [];
    }
}

function syncFields() {
    document.getElementById("customActivityField").hidden = activity.value !== "__custom__";
    const type = scheduleType.value;
    const calendar = ["day", "week", "month"].includes(type);
    document.getElementById("scheduleDateField").hidden = !calendar;
    document.getElementById("weekdayField").hidden = type !== "weekly";
    document.getElementById("monthDayField").hidden = type !== "monthly";
    if (calendar) {
        scheduleDate.type = type === "day" ? "date" : type;
        document.getElementById("scheduleDateLabel").textContent = { day: "Date", week: "Week", month: "Month" }[type];
    }
    document.getElementById("scheduleHint").textContent = scheduleHints[type];
}

function scheduleLabel(schedule) {
    if (schedule.type === "daily") return "Daily";
    if (schedule.type === "weekly") return "Every " + weekdayNames[Number(schedule.value)];
    if (schedule.type === "monthly") return "Monthly on day " + schedule.value + " · skips months without this date";
    if (schedule.type === "week") return "Every day · week " + schedule.value;
    if (schedule.type === "month") return "Every day · " + schedule.value;
    return "Once · " + schedule.value;
}

function displayReminders() {
    reminderList.replaceChildren();
    if (reminders.length === 0) {
        const empty = document.createElement("li");
        empty.textContent = "No reminders added yet.";
        reminderList.appendChild(empty);
        return;
    }
    reminders.forEach((reminder, index) => {
        const row = document.createElement("li");
        const details = document.createElement("span");
        details.className = "reminder-details";
        const title = document.createElement("strong");
        title.textContent = reminder.activity + " · " + reminder.time;
        const schedule = document.createElement("small");
        schedule.className = "reminder-schedule";
        schedule.textContent = scheduleLabel(reminder.schedule);
        details.append(title, schedule);

        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit";
        editBtn.addEventListener("click", () => {
            activity.value = reminder.custom ? "__custom__" : reminder.activity;
            customActivity.value = reminder.custom ? reminder.activity : "";
            reminderTime.value = reminder.time;
            scheduleType.value = reminder.schedule.type;
            syncFields();
            scheduleDate.value = "";
            weekday.value = "";
            monthDay.value = "";
            if (["day", "week", "month"].includes(reminder.schedule.type)) scheduleDate.value = reminder.schedule.value;
            if (reminder.schedule.type === "weekly") weekday.value = String(reminder.schedule.value);
            if (reminder.schedule.type === "monthly") monthDay.value = String(reminder.schedule.value);
            editIndex = index;
            addBtn.textContent = "Update Reminder";
            cancelEditBtn.hidden = false;
            message.textContent = "";
        });
        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete";
        deleteBtn.addEventListener("click", () => {
            saveReminders(reminders.filter((_, position) => position !== index), "Reminder deleted!");
        });
        row.append(details, editBtn, deleteBtn);
        reminderList.appendChild(row);
    });
}

function resetForm() {
    editIndex = -1;
    addBtn.textContent = "Add Reminder";
    cancelEditBtn.hidden = true;
    activity.value = customActivity.value = reminderTime.value = "";
    scheduleType.value = "daily";
    scheduleDate.value = weekday.value = monthDay.value = "";
    syncFields();
}

function saveReminders(next, confirmation) {
    try {
        localStorage.setItem("reminders", JSON.stringify(next));
    } catch (error) {
        message.textContent = "Could not save the change. Please try again.";
        console.warn(error);
        return;
    }
    reminders = next;
    resetForm();
    message.textContent = confirmation;
    displayReminders();
}

addBtn.addEventListener("click", () => {
    const custom = activity.value === "__custom__";
    const title = custom ? customActivity.value.trim() : activity.value;
    if ((!custom && !validActivities.has(title)) || !title || title.length > 120 ||
        !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(reminderTime.value)) {
        message.textContent = "Choose an activity or enter a custom reminder, and set a valid time.";
        return;
    }
    const type = scheduleType.value;
    let value = "";
    if (["day", "week", "month"].includes(type)) value = scheduleDate.value;
    if (type === "weekly") value = weekday.value;
    if (type === "monthly") value = monthDay.value;
    const schedule = { type, value };
    if (!validSchedule(schedule)) {
        message.textContent = "Complete the date, week, month, or repeat day for this schedule.";
        return;
    }
    const reminder = { activity: title, custom, time: reminderTime.value, schedule };
    const next = [...reminders];
    if (editIndex === -1) {
        next.push(reminder);
        saveReminders(next, "Reminder added!");
    } else {
        next[editIndex] = reminder;
        saveReminders(next, "Reminder updated!");
    }
});
activity.addEventListener("change", syncFields);
scheduleType.addEventListener("change", () => {
    scheduleDate.value = "";
    syncFields();
});
cancelEditBtn.addEventListener("click", () => {
    resetForm();
    message.textContent = "Edit cancelled.";
});
syncFields();
displayReminders();

