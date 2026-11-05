# SolatTime

SolatTime is an Electron desktop application for viewing prayer times and managing personal activity reminders.

## Features

- Country, state and city selection with saved preferences and recent locations.
- Malaysian prayer times through Solat.my using JAKIM-sourced data.
- Overseas prayer times through AlAdhan.
- Next prayer countdown, including tomorrow’s Subuh after Isyak.
- Activity suggestions based on the current prayer period.
- Create, view, update and delete reminders.
- Custom activities and daily, date, week, month, weekly and monthly schedule settings.
- Local Storage persistence.
- Animated sky with real-time and simulation modes.

## Requirements

- Node.js and npm.
- Internet access for API-based features.

## Installation and Running

1. Download this repository using **Code → Download ZIP**.
2. Extract the ZIP.
3. Open a terminal in the extracted folder containing `package.json`.
4. Install dependencies:

   `npm install`

5. Launch the application:

   `npm start`

## APIs

- Solat.my — Malaysian prayer timetable data.
- AlAdhan — overseas prayer calculations.
- CountriesNow — country, state and city lists.
- Open-Meteo Geocoding — overseas location coordinates and time zones.

## Notes

Reminder schedules are saved settings; timed notifications are not implemented.

Simulation mode previews the sky at five seconds per hour. Prayer times, suggestions and the countdown continue to use real time.

The sky uses illustrative 2D lighting and approximate lunar visuals.
