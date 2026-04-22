// ====== ВСТАВ СВОЄ ПОСИЛАННЯ ТУТ ======
const MY_GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/1wM73gjHVqbY2x8nORGWLjXmTVkfx7VEpdqSRtBuqdsI/edit?gid=0#gid=0";
// ======================================

const lightMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OSM', maxZoom: 19, crossOrigin: true });
const darkMap = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; CartoDB', maxZoom: 20, crossOrigin: true });
const satelliteMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '&copy; Esri', maxZoom: 18, crossOrigin: true });

const map = L.map('map', { 
    center: [48.37, 31.16], 
    zoom: 6, 
    layers: [lightMap],
    zoomControl: false, // Відключаємо стандартний зум зліва, щоб не ховався під панеллю
    zoomSnap: 0.1,        
    zoomDelta: 0.5,       
    wheelPxPerZoomLevel: 120 
});
L.control.zoom({ position: 'bottomright' }).addTo(map); // Додаємо зум справа знизу

const baseMaps = { "Світла": lightMap, "Темна": darkMap,  "Супутник": satelliteMap };
L.control.layers(baseMaps, null, {position: 'topright'}).addTo(map);

// Логіка автоприховування панелі
const controlsPanel = document.getElementById('controls');
let hidePanelTimeout;

controlsPanel.addEventListener('mouseleave', () => {
    hidePanelTimeout = setTimeout(() => { controlsPanel.classList.add('hidden-panel'); }, 1000);
});
controlsPanel.addEventListener('mouseenter', () => {
    clearTimeout(hidePanelTimeout);
    controlsPanel.classList.remove('hidden-panel');
});
document.addEventListener('mousemove', (e) => {
    // Якщо курсор ближче ніж 15px до лівого краю — показуємо панель
    if (e.clientX <= 30 && controlsPanel.classList.contains('hidden-panel')) {
        controlsPanel.classList.remove('hidden-panel');
    }
});

let ukraineLayer = null; 
function loadUkraineBounds() {
    const ukraineGeoJsonUrl = 'https://raw.githubusercontent.com/johan/world.geo.json/master/countries/UKR.geo.json';
    const selectedColor = document.getElementById('borderColorSelect').value;

    fetch(ukraineGeoJsonUrl)
        .then(response => response.json())
        .then(data => {
            if (ukraineLayer) map.removeLayer(ukraineLayer);
            ukraineLayer = L.layerGroup().addTo(map);
            const glowLayers = [{ weight: 24, opacity: 0.02 }, { weight: 16, opacity: 0.05 }, { weight: 10, opacity: 0.1 }, { weight: 6,  opacity: 0.2 }];
            glowLayers.forEach(glow => {
                L.geoJSON(data, { style: { color: selectedColor, weight: glow.weight, opacity: glow.opacity, fill: false, lineJoin: 'round', lineCap: 'round'}, interactive: false }).addTo(ukraineLayer);
            });
            L.geoJSON(data, { style: { stroke: false, fillColor: selectedColor, fillOpacity: 0.03 }, interactive: false }).addTo(ukraineLayer);
            L.geoJSON(data, { style: { color: selectedColor, weight: 2, opacity: 1, fill: false, lineJoin: 'round', lineCap: 'round' }, interactive: false }).addTo(ukraineLayer);
        })
        .catch(err => console.error("Не вдалося завантажити кордони:", err));
}
loadUkraineBounds();
document.getElementById('borderColorSelect').addEventListener('change', loadUkraineBounds);

const screenshoter = L.simpleMapScreenshoter({ hidden: true, mimeType: 'image/png' }).addTo(map);

const linesLayerGroup = L.layerGroup().addTo(map);
const markersLayerGroup = L.layerGroup().addTo(map);
const sequenceLayerGroup = L.layerGroup().addTo(map);
let sequentialInterval; 

let cachedData = []; 
let filterableColumns = []; 

const weightInput = document.getElementById('weightRange');
const colorSelect = document.getElementById('colorSelect');
const showTimeToggle = document.getElementById('showTimeLabel');
const showEHToggle = document.getElementById('showEHLabel');
const cityLabelsToggle = document.getElementById('showCityLabels'); 
const animateToggle = document.getElementById('animateFlow');
const sequentialToggle = document.getElementById('sequentialAnimation');
const statusDiv = document.getElementById('status');
const snapBtn = document.getElementById('snapBtn');
const loadSheetBtn = document.getElementById('loadSheetBtn');
const sheetStatus = document.getElementById('sheetStatus');

function parseGoogleSheetUrl(url) {
    const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    const gidMatch = url.match(/[#&]gid=([0-9]+)/);
    if (!idMatch) return null;
    return { id: idMatch[1], gid: gidMatch ? gidMatch[1] : '0' };
}

loadSheetBtn.addEventListener('click', async () => {
    const sheetInfo = parseGoogleSheetUrl(MY_GOOGLE_SHEET_URL);
    if (!sheetInfo) {
        sheetStatus.innerHTML = "<span style='color:#ef4444'>Некоректне посилання в коді!</span>";
        return;
    }

    loadSheetBtn.innerHTML = "⏳ Завантаження...";
    sheetStatus.innerHTML = "";

    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetInfo.id}/gviz/tq?tqx=out:csv&gid=${sheetInfo.gid}`;

    try {
        const response = await fetch(exportUrl);
        if (!response.ok) throw new Error("Не вдалося завантажити.");
        
        const csvText = await response.text();
        const workbook = XLSX.read(csvText, {type: 'string'});
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {defval: ""});
        
        processData(jsonData);
        
        loadSheetBtn.innerHTML = "✅ Завантажено";
        sheetStatus.innerHTML = "<span style='color:#10b981'>Дані успішно оновлено</span>";
        setTimeout(() => { loadSheetBtn.innerHTML = "🔄 Оновити дані"; }, 3000);

    } catch (err) {
        console.error(err);
        sheetStatus.innerHTML = `<span style='color:#ef4444'>Помилка завантаження</span>`;
        loadSheetBtn.innerHTML = "🔄 Оновити дані";
    }
});

// Автозавантаження при старті
setTimeout(() => loadSheetBtn.click(), 500);

function formatExcelDate(val) {
    const numVal = Number(val);
    if (!isNaN(numVal) && numVal > 30000 && numVal < 100000) {
        const date = new Date(Math.round((numVal - 25569) * 86400 * 1000));
        return date.toLocaleDateString('ru-RU');
    }
    return String(val); 
}

function processData(data) {
    cachedData = [];
    filterableColumns = [];
    let bounds = new L.LatLngBounds();

    if (data.length === 0) return;

    const keys = Object.keys(data[0]);
    const latAKey = keys.find(k => /Lat1/i.test(k) || /широта.*а|lat.*a/i.test(k));
    const lngAKey = keys.find(k => /Lon1/i.test(k) || /довгота.*а|долгота.*а|lon.*a|lng.*a/i.test(k));
    const latBKey = keys.find(k => /Lat2/i.test(k) || /широта.*б|lat.*b/i.test(k));
    const lngBKey = keys.find(k => /Lon2/i.test(k) || /довгота.*б|долгота.*б|lon.*b|lng.*b/i.test(k));

    const durationKey = keys.find(k => /тривалість|швидкість/i.test(k));
    const enKey = keys.find(k => /^ен$/i.test(k) || /ен\s/i.test(k)); 

    const excludeFromFilters = [latAKey, lngAKey, latBKey, lngBKey, durationKey, enKey];
    filterableColumns = keys.filter(k => !excludeFromFilters.includes(k) && k.trim() !== "");

    const filterOptions = {};
    filterableColumns.forEach(col => filterOptions[col] = new Set());

    data.forEach(row => {
        if (latAKey && lngAKey && latBKey && lngBKey) {
            const latA = parseFloat(row[latAKey]);
            const lngA = parseFloat(row[lngAKey]);
            const latB = parseFloat(row[latBKey]);
            const lngB = parseFloat(row[lngBKey]);

            if (!isNaN(latA) && !isNaN(lngA) && !isNaN(latB) && !isNaN(lngB)) {
                
                let item = { latA, lngA, latB, lngB, rawData: {} };
                
                filterableColumns.forEach(col => {
                    let val = row[col];
                    if (/дата|date/i.test(col) && val) val = formatExcelDate(val);
                    val = String(val).trim();
                    item.rawData[col] = val;
                    if (val !== "") filterOptions[col].add(val);
                });

                const cityAKey = keys.find(k => /ФРД.*А/i.test(k));
                const cityBKey = keys.find(k => /ФРД.*Б/i.test(k));
                item.cityA = cityAKey && row[cityAKey] ? String(row[cityAKey]).trim() : "Точка А";
                item.cityB = cityBKey && row[cityBKey] ? String(row[cityBKey]).trim() : "Точка Б";

                item.durationSec = 0;
                item.eh = 0;

                if (durationKey && row[durationKey] !== undefined && row[durationKey] !== "") {
                    let val = String(row[durationKey]).trim();
                    
                    // Якщо час у форматі "19:24:37"
                    if (val.includes(':')) {
                        let parts = val.split(':');
                        let h = parseInt(parts[0]) || 0;
                        let m = parseInt(parts[1]) || 0;
                        let s = parseInt(parts[2]) || 0;
                        item.durationSec = (h * 3600) + (m * 60) + s;
                    } else {
                        // Якщо це раптом десятковий дріб від Excel
                        let numVal = Number(val);
                        if (!isNaN(numVal)) {
                            item.durationSec = numVal * 24 * 3600;
                        }
                    }
                }
                
                if (enKey && row[enKey] !== undefined && row[enKey] !== "") {
                    let val = Number(row[enKey]);
                    if (!isNaN(val)) item.eh = val;
                }

                cachedData.push(item);
                bounds.extend([latA, lngA]);
                bounds.extend([latB, lngB]);
            }
        }
    });

    if (cachedData.length > 0) {
        renderDynamicFilters(filterOptions);
        drawLogisticsMap();
        map.fitBounds(bounds, { padding: [50, 50] });
    } else {
        sheetStatus.innerHTML = "<span style='color:#ef4444'>Координати не знайдені</span>";
    }
}

function renderDynamicFilters(filterOptions) {
    const containerGeneral = document.getElementById('dynamicFiltersGeneral');
    const containerA = document.getElementById('dynamicFiltersA');
    const containerB = document.getElementById('dynamicFiltersB');
    
    if (containerGeneral) containerGeneral.innerHTML = '';
    containerA.innerHTML = '';
    containerB.innerHTML = '';

    filterableColumns.forEach(col => {
        const options = Array.from(filterOptions[col]).filter(v => v !== "").sort();
        if (options.length === 0) return;

        const groupDiv = document.createElement('div');
        groupDiv.className = 'dynamic-filter-group';
        groupDiv.innerHTML = `<h5>📌 ${col}</h5><div class="filter-list" id="filter_list_${col}"></div>`;

        const colNameLower = col.trim().toLowerCase();
        
        // 1. Якщо це Дата - кидаємо нагору (на всю ширину)
        if (colNameLower.includes('дата') || colNameLower.includes('date')) {
            if (containerGeneral) containerGeneral.appendChild(groupDiv);
        }
        // 2. Якщо це Отримувач (закінчується на Б або містить "отримувач")
        else if (colNameLower.endsWith('б') || colNameLower.endsWith('b') || colNameLower.includes('отримувач')) {
            containerB.appendChild(groupDiv);
        } 
        // 3. Все інше (Відправник)
        else {
            containerA.appendChild(groupDiv);
        }

        const listDiv = groupDiv.querySelector('.filter-list');
        options.forEach(opt => {
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" value="${opt}" data-column="${col}" class="dynamic-checkbox"> ${opt}`;
            label.querySelector('input').addEventListener('change', drawLogisticsMap);
            listDiv.appendChild(label);
        });
    });
}

function drawLogisticsMap() {
    linesLayerGroup.clearLayers();
    markersLayerGroup.clearLayers();
    sequenceLayerGroup.clearLayers();
    if (sequentialInterval) clearInterval(sequentialInterval);

    if (cachedData.length === 0) return;

    const weight = parseInt(weightInput.value);
    const color = colorSelect.value;
    const showTime = showTimeToggle.checked;
    const showEH = showEHToggle.checked;
    const showCityNames = cityLabelsToggle.checked; 
    const isAnimated = animateToggle.checked;
    const isRadarSequence = sequentialToggle.checked;

    document.getElementById('weightVal').textContent = weight;

    const activeFilters = {};
    document.querySelectorAll('.dynamic-checkbox:checked').forEach(cb => {
        const col = cb.getAttribute('data-column');
        if (!activeFilters[col]) activeFilters[col] = [];
        activeFilters[col].push(cb.value);
    });

    let filteredData = cachedData.filter(item => {
        for (const col in activeFilters) {
            if (activeFilters[col].length > 0 && !activeFilters[col].includes(item.rawData[col])) {
                return false; 
            }
        }
        return true;
    });

    if (filteredData.length === 0) {
        statusDiv.innerHTML = `Показано: <span style="color:#38bdf8">0</span>`;
        return;
    }

    const routeGroups = {};

    filteredData.forEach(item => {
        const routeKey = `${item.latA}_${item.lngA}_${item.latB}_${item.lngB}`;
        if (!routeGroups[routeKey]) {
            routeGroups[routeKey] = {
                latA: item.latA, lngA: item.lngA, latB: item.latB, lngB: item.lngB,
                cityA: item.cityA, cityB: item.cityB,
                totalEH: 0, totalFundSec: 0, sumDurationSec: 0, count: 0
            };
        }
        routeGroups[routeKey].totalEH += item.eh;
        routeGroups[routeKey].totalFundSec += (item.durationSec * item.eh);
        routeGroups[routeKey].sumDurationSec += item.durationSec;
        routeGroups[routeKey].count += 1;
    });

    filteredData = Object.values(routeGroups).map(group => {
        let avgDurationSec = group.totalEH > 0 ? group.totalFundSec / group.totalEH : group.sumDurationSec / group.count;
        let metricsArray = [];

        // Додаємо час тільки якщо включений відповідний чекбокс
        if (showTime && avgDurationSec > 0) {
            const h = Math.floor(avgDurationSec / 3600);
            const m = Math.floor((avgDurationSec % 3600) / 60);
            const s = Math.round(avgDurationSec % 60);
            metricsArray.push(`${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        }
        
        // Додаємо ЕН тільки якщо включений відповідний чекбокс
        if (showEH && group.totalEH > 0) {
            metricsArray.push(`${Math.round(group.totalEH)} ЕН`);
        }
        
        group.metricsHtml = metricsArray.join(' | ');
        return group;
    });

    const drawnCities = new Set(); 
    
    // --- ДИНАМІЧНИЙ ЗСУВ МІТОК ---
    const uniqueSenders = new Set();
    const uniqueReceivers = new Set();
    
    filteredData.forEach(item => {
        uniqueSenders.add(item.cityA);
        uniqueReceivers.add(item.cityB);
    });

    let labelOffset = 0.5; // За замовчуванням по центру (якщо порівну)
    
    if (uniqueSenders.size < uniqueReceivers.size) {
        // Відправників менше (розходиться віялом) -> зсуваємо до отримувачів
        labelOffset = 0.75; 
    } else if (uniqueSenders.size > uniqueReceivers.size) {
        // Отримувачів менше (сходиться в одну точку) -> зсуваємо до відправників
        labelOffset = 0.25; 
    }
    if (isRadarSequence) {
        filteredData.forEach(item => {
            const cityIdA = `${item.latA}_${item.lngA}`;
            if (!drawnCities.has(cityIdA)) {
                L.circleMarker([item.latA, item.lngA], { radius: Math.max(weight + 1, 4), color: '#fff', weight: 1, fillColor: color, fillOpacity: 1 })
                .bindTooltip(item.cityA, { permanent: showCityNames, direction: 'top', offset: [0, -10], className: showCityNames ? 'city-label-tooltip' : '' }).addTo(markersLayerGroup);
                drawnCities.add(cityIdA);
            }
            item.angle = Math.atan2(item.lngB - item.lngA, item.latB - item.latA);
        });
        filteredData.sort((a, b) => a.angle - b.angle);

        let i = 0;
        const tick = () => {
            const item = filteredData[i];
            const tempGroup = L.layerGroup().addTo(sequenceLayerGroup);
            const latlngA = L.latLng(item.latA, item.lngA);
            const latlngB = L.latLng(item.latB, item.lngB);

            L.polyline([latlngA, latlngB], { color: color, weight: weight, className: 'radar-fade' }).addTo(tempGroup);
            if (isAnimated) L.polyline([latlngA, latlngB], { color: '#ffffff', weight: Math.max(1, weight - 1), dashArray: '15, 85', className: 'animated-flow radar-fade' }).addTo(tempGroup);

            if (item.metricsHtml !== "") {
                const pA = map.project(latlngA, 0); const pB = map.project(latlngB, 0);
                const targetPoint = map.unproject(L.point(pA.x + (pB.x - pA.x) * labelOffset, pA.y + (pB.y - pA.y) * labelOffset), 0);
                let textAngle = Math.atan2(pB.y - pA.y, pB.x - pA.x) * (180 / Math.PI);
                if (pB.x < pA.x) textAngle += 180;
                const labelIcon = L.divIcon({ className: 'rotated-label-container radar-fade', html: `<div class="rotated-label-content" style="transform: translate(-50%, -50%) rotate(${textAngle}deg) translateY(-20px); border-color: ${color};">${item.metricsHtml}</div>`, iconSize: [0, 0] });
                L.marker(targetPoint, { icon: labelIcon }).addTo(tempGroup);
            }

            L.circleMarker([item.latB, item.lngB], { radius: Math.max(weight + 1, 4), color: '#fff', weight: 1, fillColor: color, className: 'radar-fade' })
            .bindTooltip(item.cityB, { permanent: showCityNames, direction: 'top', offset: [0, -10], className: showCityNames ? 'city-label-tooltip radar-fade' : 'radar-fade' }).addTo(tempGroup);

            setTimeout(() => { if (map.hasLayer(sequenceLayerGroup) && sequenceLayerGroup.hasLayer(tempGroup)) sequenceLayerGroup.removeLayer(tempGroup); }, 1100);
            i = (i + 1) % filteredData.length; 
        };
        tick(); 
        sequentialInterval = setInterval(tick, 100);
        statusDiv.innerHTML = `Режим радару: <span style="color:#38bdf8">${filteredData.length}</span> напрямків`;

    } else {
        filteredData.forEach(item => {
            const latlngA = L.latLng(item.latA, item.lngA); const latlngB = L.latLng(item.latB, item.lngB);
            L.polyline([latlngA, latlngB], { color: color, weight: weight, opacity: isAnimated ? 0.3 : 0.6 }).addTo(linesLayerGroup);
            if (isAnimated) L.polyline([latlngA, latlngB], { color: '#ffffff', weight: Math.max(1, weight - 1), opacity: 0.8, dashArray: '15, 85', className: 'animated-flow' }).addTo(linesLayerGroup);

            if (item.metricsHtml !== "") {
                const pA = map.project(latlngA, 0); const pB = map.project(latlngB, 0);
                const targetPoint = map.unproject(L.point(pA.x + (pB.x - pA.x) * labelOffset, pA.y + (pB.y - pA.y) * labelOffset), 0);
                let angle = Math.atan2(pB.y - pA.y, pB.x - pA.x) * (180 / Math.PI);
                if (pB.x < pA.x) angle += 180;
                const labelIcon = L.divIcon({ className: 'rotated-label-container', html: `<div class="rotated-label-content" style="transform: translate(-50%, -50%) rotate(${angle}deg) translateY(-20px); border-color: ${color};">${item.metricsHtml}</div>`, iconSize: [0, 0] });
                L.marker(targetPoint, { icon: labelIcon }).addTo(linesLayerGroup);
            }

            const drawCityMarker = (lat, lng, name) => {
                const cityId = `${lat}_${lng}`; 
                if (!drawnCities.has(cityId)) {
                    L.circleMarker([lat, lng], { radius: Math.max(weight + 1, 4), color: '#fff', weight: 1, fillColor: color, fillOpacity: 1 })
                    .bindTooltip(name, { permanent: showCityNames, direction: 'top', offset: [0, -10], className: showCityNames ? 'city-label-tooltip' : '' }).addTo(markersLayerGroup);
                    drawnCities.add(cityId); 
                }
            };
            drawCityMarker(item.latA, item.lngA, item.cityA);
            drawCityMarker(item.latB, item.lngB, item.cityB);
        });
        statusDiv.innerHTML = `Показано напрямків: <span style="color:#38bdf8">${filteredData.length}</span>`;
    }
}

snapBtn.addEventListener('click', function() {
    const originalText = snapBtn.textContent;
    snapBtn.textContent = "⏳ Створення знімку...";
    screenshoter.takeScreen('blob').then(blob => {
        const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `logistics_export_${new Date().getTime()}.png`; link.click();
        snapBtn.textContent = originalText;
    }).catch(e => { console.error(e); alert("Помилка."); snapBtn.textContent = originalText; });
});

weightInput.addEventListener('input', drawLogisticsMap);
colorSelect.addEventListener('change', drawLogisticsMap);
showTimeToggle.addEventListener('change', drawLogisticsMap);
showEHToggle.addEventListener('change', drawLogisticsMap);
cityLabelsToggle.addEventListener('change', drawLogisticsMap); 
animateToggle.addEventListener('change', drawLogisticsMap);
sequentialToggle.addEventListener('change', drawLogisticsMap);