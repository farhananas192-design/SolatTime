// Approximate lunation from the 6 January 2000 18:14 UTC new moon.
// Mean synodic month, US Naval Observatory: 29.5305888531 days.
function moonPhase(timestamp) {
    const cycle = 29.5305888531 * 86400000;
    const age = (timestamp - Date.UTC(2000, 0, 6, 18, 14)) / cycle;
    const phase = ((age % 1) + 1) % 1;
    return { phase, illumination: (1 - Math.cos(2 * Math.PI * phase)) / 2 };
}

if (typeof module !== "undefined") module.exports = { moonPhase };
else window.SolatMoon = { moonPhase };
