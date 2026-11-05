(() => {
    const canvas = document.getElementById("skyCanvas");
    if (!canvas) return;
    const hero = canvas.parentElement;
    const context = canvas.getContext("2d");
    const backdrop = document.createElement("canvas");
    const effects = document.createElement("canvas");
    const light = document.createElement("canvas");
    const backdropContext = backdrop.getContext("2d");
    const effectsContext = effects.getContext("2d");
    const lightContext = light.getContext("2d");
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const random = (min, max) => min + Math.random() * (max - min);
    let width = 0;
    let height = 0;
    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;
    let density = 1;
    let sceneTime = 0;
    let lastFrame = 0;

    function image(source) {
        return new Promise((resolve, reject) => {
            const asset = new Image();
            asset.onload = () => resolve(asset);
            asset.onerror = () => reject(new Error("Could not load sky artwork."));
            asset.src = source;
        });
    }

    Promise.all([
        image("assets/header-neutral.png"),
        image("assets/cloud-cumulus.png"),
        image("assets/lantern.png")
    ]).then(([background, cloudImage, lantern]) => {
        const sourceWidth = background.naturalWidth;
        const sourceHeight = background.naturalHeight;
        const skyMask = document.createElement("canvas");
        skyMask.width = sourceWidth;
        skyMask.height = sourceHeight;
        const maskContext = skyMask.getContext("2d", { willReadFrequently: true });
        maskContext.drawImage(background, 0, 0);
        const pixels = maskContext.getImageData(0, 0, sourceWidth, sourceHeight);
        const structureMask = document.createElement("canvas");
        structureMask.width = sourceWidth;
        structureMask.height = sourceHeight;
        const structureContext = structureMask.getContext("2d");
        const structurePixels = structureContext.createImageData(sourceWidth, sourceHeight);
        const figurePixels = structureContext.createImageData(sourceWidth, sourceHeight);

        // Sky colour and the scene's openings define the occlusion mask.
        // Stone, the praying figure and the carpet always cover celestial effects.
        for (let y = 0; y < sourceHeight; y++) {
            for (let x = 0; x < sourceWidth; x++) {
                const index = (y * sourceWidth + x) * 4;
                const red = pixels.data[index];
                const green = pixels.data[index + 1];
                const blue = pixels.data[index + 2];
                const openLeft = x < sourceWidth * .576 && y < sourceHeight * .92;
                const openArch = x > sourceWidth * .669 && x < sourceWidth * .913 && y < sourceHeight * .919;

                const edge = Math.max(0, Math.min(1, (blue - green - 2) / 5)) *
                    Math.max(0, Math.min(1, (green - red - 8) / 8));
                pixels.data[index] = pixels.data[index + 1] = pixels.data[index + 2] = 255;
                pixels.data[index + 3] = openLeft || openArch ? Math.round(edge * 255) : 0;
                const pillar = x >= sourceWidth * .576 && (x < sourceWidth * .669 || x >= sourceWidth * .913);
                const arch = x >= sourceWidth * .669 && x < sourceWidth * .913 && y < sourceHeight * .47;
                const figureRegion = x > sourceWidth * .718 && x < sourceWidth * .823 &&
                    y > sourceHeight * .65 && y < sourceHeight * .923;
                const skyColour = Math.max(0, Math.min(1, (blue - green - 3) / 8)) *
                    Math.max(0, Math.min(1, (green - 80) / 40)) *
                    Math.max(0, Math.min(1, (green - red * 1.7) / 40));
                figurePixels.data[index] = figurePixels.data[index + 1] = figurePixels.data[index + 2] = 255;
                figurePixels.data[index + 3] = figureRegion ? Math.round((1 - skyColour) * 255) : 0;
                const floor = y >= sourceHeight * .923;
                structurePixels.data[index] = structurePixels.data[index + 1] = structurePixels.data[index + 2] = 255;
                structurePixels.data[index + 3] = pillar || floor ? 255 : arch ? Math.round((1 - edge) * 255) : 0;
            }
        }
        maskContext.putImageData(pixels, 0, 0);
        structureContext.putImageData(structurePixels, 0, 0);
        const figureMask = document.createElement("canvas");
        figureMask.width = sourceWidth;
        figureMask.height = sourceHeight;
        const figureContext = figureMask.getContext("2d");
        figureContext.putImageData(figurePixels, 0, 0);
        structureContext.drawImage(figureMask, 0, 0);
        maskContext.globalCompositeOperation = "destination-out";
        maskContext.drawImage(figureMask, 0, 0);
        maskContext.globalCompositeOperation = "source-over";
        const clouds = Array.from({ length: 7 }, () => ({
            x: random(-650, sourceWidth), y: random(45, 345), width: random(260, 620),
            speed: random(12, 30) * (Math.random() < .2 ? -1 : 1),
            phase: random(0, Math.PI * 2), float: random(3, 12), opacity: random(.55, .85), growth: random(.11, .23), period: random(.08, .17)
        }));
        const stars = Array.from({ length: 350 }, () => ({
            x: random(0, sourceWidth), y: random(0, 455), radius: random(.65, 1.8),
            speedX: random(-.65, .65), speedY: random(-.18, .18),
            phase: random(0, Math.PI * 2), period: random(1.8, 6), brightness: random(.55, 1)
        }));

        const galaxy = document.createElement("canvas");
        galaxy.width = sourceWidth;
        galaxy.height = sourceHeight * 2;
        const galaxyContext = galaxy.getContext("2d");
        // A cached star band gives a dense sky without painting thousands of dots per frame.
        for (let cluster = 0; cluster < 18; cluster++) {
            const y = cluster / 17 * galaxy.height;
            const x = sourceWidth * .48 + (y - galaxy.height / 2) * .5;
            const mist = galaxyContext.createRadialGradient(x, y, 0, x, y, 145);
            mist.addColorStop(0, "rgba(133,160,238,.12)");
            mist.addColorStop(1, "rgba(83,112,219,0)");
            galaxyContext.fillStyle = mist;
            galaxyContext.fillRect(x - 145, y - 145, 290, 290);
        }
        for (let star = 0; star < 4500; star++) {
            const y = random(0, galaxy.height);
            const spread = (Math.random() + Math.random() + Math.random() - 1.5) * 160;
            const x = sourceWidth * .48 + (y - galaxy.height / 2) * .5 + spread;
            galaxyContext.globalAlpha = random(.12, .7);
            galaxyContext.fillStyle = star % 4 === 0 ? "#a6c8ff" : "#e9eeff";
            galaxyContext.beginPath();
            galaxyContext.arc(x, y, random(.25, 1.1), 0, Math.PI * 2);
            galaxyContext.fill();
        }
        galaxyContext.globalAlpha = 1;

        function sourceTransform(ctx) {
            ctx.translate(offsetX, offsetY);
            ctx.scale(scale, scale);
        }

        function applyMask(ctx, mask = skyMask) {
            ctx.save();
            ctx.globalCompositeOperation = "destination-in";
            ctx.drawImage(mask, offsetX, offsetY, sourceWidth * scale, sourceHeight * scale);
            ctx.restore();
        }

        function resize() {
            width = hero.clientWidth;
            height = hero.clientHeight;
            density = Math.min(devicePixelRatio || 1, 1.5);
            for (const layer of [canvas, backdrop, effects, light]) {
                layer.width = Math.round(width * density);
                layer.height = Math.round(height * density);
                layer.getContext("2d").setTransform(density, 0, 0, density, 0, 0);
            }
            scale = Math.max(width / sourceWidth, height / sourceHeight);
            offsetX = (width - sourceWidth * scale) * (width <= 640 ? .62 : .5);
            offsetY = (height - sourceHeight * scale) * (width <= 640 ? .5 : .72);
            backdropContext.drawImage(background, offsetX, offsetY, sourceWidth * scale, sourceHeight * scale);
        }

        function clear(ctx) {
            ctx.clearRect(0, 0, width, height);
        }

        function drawClouds() {
            effectsContext.save();
            sourceTransform(effectsContext);
            for (const cloud of clouds) {
                const span = sourceWidth + cloud.width * 2;
                const x = ((cloud.x + sceneTime * cloud.speed + cloud.width) % span + span) % span - cloud.width;
                const y = cloud.y + Math.sin(sceneTime * .16 + cloud.phase) * cloud.float;
                effectsContext.globalAlpha = cloud.opacity;
                const expansion = 1 + Math.sin(sceneTime * cloud.period + cloud.phase) * cloud.growth;
                const cloudWidth = cloud.width * expansion;
                const cloudHeight = cloud.width * .32 * (1 + Math.cos(sceneTime * cloud.period * .8 + cloud.phase) * .16);
                effectsContext.drawImage(cloudImage, x - (cloudWidth - cloud.width) / 2,
                    y - cloudHeight / 2, cloudWidth, cloudHeight);
            }
            effectsContext.restore();
        }

        function drawHorizonGlow(x, horizon, intensity) {
            if (intensity <= 0) return;
            effectsContext.save();
            effectsContext.translate(x, horizon);
            effectsContext.scale(2, .8);
            const glow = effectsContext.createRadialGradient(0, 0, 0, 0, 0, 100);
            glow.addColorStop(0, "rgba(255,203,114," + intensity * .8 + ")");
            glow.addColorStop(.35, "rgba(255,174,86," + intensity * .4 + ")");
            glow.addColorStop(1, "#ffae5600");
            effectsContext.fillStyle = glow;
            effectsContext.fillRect(-100, -100, 200, 200);
            effectsContext.restore();
        }

        function drawSun(x, y, glow) {
            const radius = Math.max(14, Math.min(24, width * .0165));
            effectsContext.save();
            effectsContext.globalAlpha = glow;
            effectsContext.globalCompositeOperation = "screen";
            const halo = effectsContext.createRadialGradient(x, y, radius * .5, x, y, radius * 5);
            halo.addColorStop(0, "#fff1bbbf");
            halo.addColorStop(.3, "#ffd59166");
            halo.addColorStop(1, "#ffd59100");
            effectsContext.fillStyle = halo;
            effectsContext.fillRect(x - radius * 5, y - radius * 5, radius * 10, radius * 10);
            // Soft light shafts spill through the sky beside the column edges.
            const rays = effectsContext.createRadialGradient(x, y, radius, x, y, radius * 5);
            rays.addColorStop(0, "#ffe5ac24");
            rays.addColorStop(1, "#ffe5ac00");
            effectsContext.fillStyle = rays;
            effectsContext.filter = "blur(2px)";
            for (let ray = 0; ray < 8; ray++) {
                const angle = ray * Math.PI / 4 + sceneTime * .015;
                effectsContext.beginPath();
                effectsContext.moveTo(x, y);
                effectsContext.lineTo(x + Math.cos(angle - .04) * radius * 5, y + Math.sin(angle - .04) * radius * 5);
                effectsContext.lineTo(x + Math.cos(angle + .04) * radius * 5, y + Math.sin(angle + .04) * radius * 5);
                effectsContext.closePath();
                effectsContext.fill();
            }
            effectsContext.filter = "none";
            effectsContext.globalCompositeOperation = "source-over";
            effectsContext.fillStyle = "#fff6bd";
            effectsContext.beginPath();
            effectsContext.arc(x, y, radius, 0, Math.PI * 2);
            effectsContext.fill();
            effectsContext.restore();
        }

        function drawStructureLighting(sunX, sunY, strength) {
            clear(lightContext);
            const shade = lightContext.createLinearGradient(0, 0, width, 0);
            const rightSun = sunX / width;
            shade.addColorStop(0, "rgba(0,15,26," + (.12 + rightSun * .20 + (1 - strength) * .38) + ")");
            shade.addColorStop(1, "rgba(0,15,26," + (.32 - rightSun * .20 + (1 - strength) * .38) + ")");
            lightContext.fillStyle = shade;
            lightContext.fillRect(0, 0, width, height);
            const warmth = lightContext.createRadialGradient(sunX, sunY, 10, sunX, sunY, width * .75);
            warmth.addColorStop(0, "rgba(255,222,157," + strength * .30 + ")");
            warmth.addColorStop(1, "#ffe1a100");
            lightContext.fillStyle = warmth;
            lightContext.fillRect(0, 0, width, height);
            applyMask(lightContext, structureMask);
            context.drawImage(light, 0, 0, width, height);
        }

        function surfaceReflection(x, y, intensity, radius, mask = structureMask, lightGradient) {
            if (intensity <= 0) return;
            clear(lightContext);
            const reflection = lightGradient ?? lightContext.createRadialGradient(x, y, 0, x, y, radius);
            if (!lightGradient) {
                reflection.addColorStop(0, "rgba(255,206,125," + intensity + ")");
                reflection.addColorStop(.45, "rgba(255,180,82," + intensity * .65 + ")");
                reflection.addColorStop(1, "#ffb45200");
            }
            // Relight the original material texture instead of covering it with a flat glow.
            lightContext.filter = "grayscale(.45) brightness(1.35)";
            lightContext.drawImage(backdrop, 0, 0, width, height);
            lightContext.filter = "none";
            lightContext.globalCompositeOperation = "multiply";
            lightContext.fillStyle = "#ffce8f";
            lightContext.fillRect(0, 0, width, height);
            lightContext.globalCompositeOperation = "destination-in";
            lightContext.fillStyle = reflection;
            lightContext.fillRect(0, 0, width, height);
            lightContext.globalCompositeOperation = "source-over";
            applyMask(lightContext, mask);
            context.save();
            context.globalCompositeOperation = "screen";
            context.drawImage(light, 0, 0, width, height);
            context.restore();
        }

        function figureReflection(x, y, intensity) {
            if (intensity <= 0) return;
            const centreX = offsetX + sourceWidth * .77 * scale;
            const centreY = offsetY + sourceHeight * .8 * scale;
            const distance = Math.max(1, Math.hypot(x - centreX, y - centreY));
            const reach = sourceWidth * .055 * scale;
            const dx = (x - centreX) / distance * reach;
            const dy = (y - centreY) / distance * reach;
            const directional = lightContext.createLinearGradient(
                centreX - dx, centreY - dy, centreX + dx, centreY + dy);
            directional.addColorStop(0, "rgba(255,208,143,0)");
            directional.addColorStop(.5, "rgba(255,208,143," + intensity * .12 + ")");
            directional.addColorStop(1, "rgba(255,208,143," + intensity * .8 + ")");
            surfaceReflection(x, y, intensity, reach, figureMask, directional);
        }
        function drawStars(night) {
            clear(effectsContext);
            effectsContext.save();
            sourceTransform(effectsContext);
            const rotation = sceneTime * .003;
            effectsContext.translate(sourceWidth * .52, sourceHeight * .3);
            effectsContext.rotate(rotation);
            effectsContext.translate(-sourceWidth * .52, -sourceHeight * .3);
            effectsContext.globalAlpha = night * (.35 + .65 * (.5 + .5 * Math.sin(sceneTime * .055)));
            effectsContext.drawImage(galaxy, 0, -sourceHeight * .65);
            for (const star of stars) {
                const x = ((star.x + sceneTime * star.speedX) % sourceWidth + sourceWidth) % sourceWidth;
                const y = ((star.y + sceneTime * star.speedY) % 455 + 455) % 455;
                const flicker = .25 + .75 * (.5 + .5 * Math.sin(sceneTime * Math.PI * 2 / star.period + star.phase));
                effectsContext.globalAlpha = night * star.brightness * flicker;
                effectsContext.fillStyle = "#ebf7ff";
                effectsContext.beginPath();
                effectsContext.arc(x, y, star.radius, 0, Math.PI * 2);
                effectsContext.fill();
            }
            effectsContext.restore();
            applyMask(effectsContext);
            context.drawImage(effects, 0, 0, width, height);
        }

        const moonDisc = document.createElement("canvas");
        moonDisc.width = moonDisc.height = 128;
        const moonContext = moonDisc.getContext("2d");
        let moonHour;
        let moonIllumination = 0;

        function drawMoon(night) {
            if (night <= 0) return;
            // Use actual time, not the accelerated sky preview clock.
            const hour = Math.floor(Date.now() / 3600000);
            if (moonHour !== hour) {
                moonHour = hour;
                const { phase, illumination } = SolatMoon.moonPhase(Date.now());
                moonIllumination = illumination;
                const lightX = Math.sin(phase * Math.PI * 2);
                const lightZ = -Math.cos(phase * Math.PI * 2);
                const disc = moonContext.createImageData(128, 128);
                for (let y = 0; y < 128; y++) {
                    for (let x = 0; x < 128; x++) {
                        const nx = (x - 63.5) / 62;
                        const ny = (y - 63.5) / 62;
                        const squared = nx * nx + ny * ny;
                        if (squared >= 1) continue;
                        const z = Math.sqrt(1 - squared);
                        const diffuse = Math.max(0, nx * lightX + z * lightZ);
                        const texture = .88 + .12 * Math.sin(x * .27) * Math.sin(y * .19 + Math.cos(x * .11));
                        const lit = Math.pow(diffuse, .45) * texture;
                        const index = (y * 128 + x) * 4;
                        disc.data[index] = 3 + 245 * lit;
                        disc.data[index + 1] = 27 + 220 * lit;
                        disc.data[index + 2] = 42 + 210 * lit;
                        disc.data[index + 3] = Math.min(1, (1 - Math.sqrt(squared)) * 62) * 255;
                    }
                }
                moonContext.putImageData(disc, 0, 0);
            }
            if (moonIllumination < .003) return;
            // A decorative reverse arc follows the selected location's night.
            const progress = Number(document.documentElement.style.getPropertyValue("--moon-progress"));
            const x = width * (.88 - progress * .76);
            const radius = Math.max(12, Math.min(22, width * .016));
            const horizon = Math.min(height, offsetY + sourceHeight * .918 * scale);
            const y = horizon + radius - (horizon * .72 + radius) * Math.sin(progress * Math.PI);
            clear(effectsContext);
            effectsContext.save();
            effectsContext.globalAlpha = night;
            const glow = effectsContext.createRadialGradient(x, y, radius, x, y, radius * 4);
            glow.addColorStop(0, "rgba(200,221,255," + moonIllumination * .18 + ")");
            glow.addColorStop(1, "#c8ddff00");
            effectsContext.fillStyle = glow;
            effectsContext.fillRect(x - radius * 4, y - radius * 4, radius * 8, radius * 8);
            effectsContext.drawImage(moonDisc, x - radius, y - radius, radius * 2, radius * 2);
            effectsContext.restore();
            applyMask(effectsContext);
            context.drawImage(effects, 0, 0, width, height);
        }

        function drawLamp(x, y, glow) {
            const lampHeight = 135;
            const lampWidth = lampHeight * lantern.naturalWidth / lantern.naturalHeight;
            context.save();
            sourceTransform(context);
            const left = x - lampWidth / 2;
            if (glow > 0) {
                const bounce = context.createRadialGradient(x, y + 70, 5, x, y + 70, 125);
                bounce.addColorStop(0, "rgba(255,183,73," + glow * .42 + ")");
                bounce.addColorStop(1, "#ffb74900");
                context.fillStyle = bounce;
                context.fillRect(x - 125, y - 55, 250, 250);
            }
            context.drawImage(lantern, left, y, lampWidth, lampHeight);
            if (glow > 0) {
                const centreX = left + lampWidth * .57;
                const centreY = y + lampHeight * .57;
                const light = context.createRadialGradient(centreX, centreY, 1, centreX, centreY, 55);
                light.addColorStop(0, "rgba(255,241,171," + glow * .85 + ")");
                light.addColorStop(.3, "rgba(255,195,74," + glow * .55 + ")");
                light.addColorStop(1, "#ffb74900");
                context.globalCompositeOperation = "screen";
                context.fillStyle = light;
                context.fillRect(centreX - 55, centreY - 55, 110, 110);
            }
            context.restore();
        }

        function frame(timestamp) {
            requestAnimationFrame(frame);
            if (timestamp - lastFrame < (reducedMotion.matches ? 200 : 32)) return;
            const delta = Math.min(.1, (timestamp - lastFrame) / 1000);
            lastFrame = timestamp;
            const root = document.documentElement;
            const simulated = root.dataset.clockMode === "simulation";
            if (!reducedMotion.matches) sceneTime += delta * (simulated ? 2.5 : 1);
            const night = Number(root.style.getPropertyValue("--night-opacity")) || 0;
            const blue = Number(root.style.getPropertyValue("--blue-opacity")) || 0;
            const sunX = width * parseFloat(root.style.getPropertyValue("--sun-x") || "50") / 100;
            const solarProgress = Number(root.style.getPropertyValue("--solar-progress"));
            const solarGlow = Number(root.style.getPropertyValue("--solar-glow")) || 0;
            const solarStrength = Number(root.style.getPropertyValue("--solar-strength")) || 0;
            const radius = Math.max(14, Math.min(24, width * .0165));
            const horizon = Math.min(height, offsetY + sourceHeight * .918 * scale);
            const elevation = Math.sin(Math.PI * Math.max(-.2, Math.min(1.2, solarProgress)));
            const sunY = horizon + radius - (horizon * .88 + radius) * elevation;
            context.drawImage(backdrop, 0, 0, width, height);
            clear(effectsContext);
            drawHorizonGlow(sunX, horizon, solarGlow * (1 - solarStrength));
            if (solarGlow > 0) drawSun(sunX, sunY, solarGlow);

            applyMask(effectsContext);
            context.drawImage(effects, 0, 0, width, height);
            drawStructureLighting(sunX, sunY, solarStrength);
            figureReflection(sunX, sunY, solarStrength * .9);
            context.fillStyle = "rgba(1,13,29," + night * .82 + ")";
            context.fillRect(0, 0, width, height);
            context.fillStyle = "rgba(3,29,84," + blue + ")";
            context.fillRect(0, 0, width, height);
            drawStars(night);
            drawMoon(night);
            clear(effectsContext);
            effectsContext.filter = "brightness(" + (1 - night * .82) + ")";
            drawClouds();
            effectsContext.filter = "none";
            applyMask(effectsContext);
            context.drawImage(effects, 0, 0, width, height);
            const glow = night * (.96 + Math.sin(sceneTime * 1.4) * .04);
            for (const lampX of [sourceWidth * .622, sourceWidth * .955]) {
                const x = offsetX + lampX * scale;
                const y = offsetY + (sourceHeight * .53 + 77) * scale;
                surfaceReflection(x, y, glow * .42, sourceWidth * .22 * scale);
                figureReflection(x, y, glow * .15);
            }
            drawLamp(sourceWidth * .622, sourceHeight * .53, glow);
            drawLamp(sourceWidth * .955, sourceHeight * .53, glow);
        }

        new ResizeObserver(resize).observe(hero);
        resize();
        canvas.dataset.ready = "true";
        requestAnimationFrame(frame);
    }).catch(error => {
        console.error(error);
        canvas.hidden = true;
    });
})();














