// ====== ВСТАВ СВОЄ ПОСИЛАННЯ ТУТ ======
const MY_GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/1wM73gjHVqbY2x8nORGWLjXmTVkfx7VEpdqSRtBuqdsI/edit?gid=0#gid=0";
// ======================================

const lightMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OSM', maxZoom: 19, crossOrigin: true });
const darkMap = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; CartoDB', maxZoom: 20, crossOrigin: true });
const satelliteMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '&copy; Esri', maxZoom: 18, crossOrigin: true });

const map = L.map('map', { 
    center: [48.37, 31.16], 
    zoom: 6, 
    layers: [darkMap],
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
let hideControlsTimeout;

controlsPanel.addEventListener('mouseleave', () => {
    hideControlsTimeout = setTimeout(() => { controlsPanel.classList.add('hidden-panel'); }, 1000);
});
controlsPanel.addEventListener('mouseenter', () => {
    clearTimeout(hideControlsTimeout);
    controlsPanel.classList.remove('hidden-panel');
});

// Логіка автоприховування правої панелі (Налаштування)
const settingsPanel = document.getElementById('settings-panel');
let hideSettingsTimeout;

settingsPanel.addEventListener('mouseleave', () => {
    hideSettingsTimeout = setTimeout(() => { settingsPanel.classList.add('hidden-panel'); }, 1000);
});
settingsPanel.addEventListener('mouseenter', () => {
    clearTimeout(hideSettingsTimeout);
    settingsPanel.classList.remove('hidden-panel');
});

// Відстеження курсору для появи панелей
document.addEventListener('mousemove', (e) => {
    // Ліва панель (ближче ніж 30px до лівого краю)
    if (e.clientX <= 30 && controlsPanel.classList.contains('hidden-panel')) {
        controlsPanel.classList.remove('hidden-panel');
    }
    // Права панель (ближче ніж 30px до правого краю)
    if (window.innerWidth - e.clientX <= 30 && settingsPanel.classList.contains('hidden-panel')) {
        settingsPanel.classList.remove('hidden-panel');
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

// Виносимо логіку завантаження в окрему функцію
async function loadGoogleSheetData() {
    const sheetInfo = parseGoogleSheetUrl(MY_GOOGLE_SHEET_URL);
    if (!sheetInfo) return;

    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetInfo.id}/gviz/tq?tqx=out:csv&gid=${sheetInfo.gid}`;

    try {
        const response = await fetch(exportUrl);
        if (!response.ok) throw new Error("Ошибка");
        
        const csvText = await response.text();
        const workbook = XLSX.read(csvText, {type: 'string'});
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {defval: ""});
        
        processData(jsonData);
    } catch (err) {
        console.error("Ошибка загрузки данных:", err);
    }
}

// Автозавантаження при старті сторінки (замість кліку по кнопці)
setTimeout(loadGoogleSheetData, 500);

function parseGoogleSheetUrl(url) {
    const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    const gidMatch = url.match(/[#&]gid=([0-9]+)/);
    if (!idMatch) return null;
    return { id: idMatch[1], gid: gidMatch ? gidMatch[1] : '0' };
}


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
    
    // 1. Пошук ключів для координат міст (ФРД)
    const latAKey = keys.find(k => /Lat1/i.test(k) || /широта.*а|lat.*a/i.test(k));
    const lngAKey = keys.find(k => /Lon1/i.test(k) || /довгота.*а|долгота.*а|lon.*a|lng.*a/i.test(k));
    const latBKey = keys.find(k => /Lat2/i.test(k) || /широта.*б|lat.*b/i.test(k));
    const lngBKey = keys.find(k => /Lon2/i.test(k) || /довгота.*б|долгота.*б|lon.*b|lng.*b/i.test(k));

    // 2. Пошук ключів для координат ФІЛІЙ
    const latFilAKey = keys.find(k => /Lat3/i.test(k));
    const lngFilAKey = keys.find(k => /Lon3/i.test(k));
    const latFilBKey = keys.find(k => /Lat4/i.test(k));
    const lngFilBKey = keys.find(k => /Lon4/i.test(k));

    const durationKey = keys.find(k => /тривалість|швидкість/i.test(k));
    const enKey = keys.find(k => /^ен$/i.test(k) || /ен\s/i.test(k)); 

    // 3. Формуємо список колонок для фільтрів (виключаємо координати та метрики)
    const excludeFromFilters = [
        latAKey, lngAKey, latBKey, lngBKey, 
        latFilAKey, lngFilAKey, latFilBKey, lngFilBKey, 
        durationKey, enKey
    ];
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
                
                let item = { 
                    latA, lngA, latB, lngB, 
                    rawData: {} 
                };
                
                // --- ЗБИРАЄМО КООРДИНАТИ ФІЛІЙ (якщо вони заповнені) ---
                item.latFilA = (latFilAKey && row[latFilAKey]) ? parseFloat(row[latFilAKey]) : null;
                item.lngFilA = (lngFilAKey && row[lngFilAKey]) ? parseFloat(row[lngFilAKey]) : null;
                item.latFilB = (latFilBKey && row[latFilBKey]) ? parseFloat(row[latFilBKey]) : null;
                item.lngFilB = (lngFilBKey && row[lngFilBKey]) ? parseFloat(row[lngFilBKey]) : null;

                // Збираємо дані для фільтрів
                filterableColumns.forEach(col => {
                    let val = row[col];
                    if (/дата|date/i.test(col) && val) val = formatExcelDate(val);
                    val = String(val).trim();
                    item.rawData[col] = val;
                    if (val !== "") filterOptions[col].add(val);
                });

                // Визначаємо назви точок для підписів
                const cityAKey = keys.find(k => /ФРД.*А/i.test(k));
                const cityBKey = keys.find(k => /ФРД.*Б/i.test(k));
                item.cityA = cityAKey && row[cityAKey] ? String(row[cityAKey]).trim() : "Точка А";
                item.cityB = cityBKey && row[cityBKey] ? String(row[cityBKey]).trim() : "Точка Б";

                // Обробка часу (Duration)
                item.durationSec = 0;
                if (durationKey && row[durationKey] !== undefined && row[durationKey] !== "") {
                    let val = String(row[durationKey]).trim();
                    if (val.includes(':')) {
                        let parts = val.split(':');
                        item.durationSec = (parseInt(parts[0]) || 0) * 3600 + (parseInt(parts[1]) || 0) * 60 + (parseInt(parts[2]) || 0);
                    } else {
                        let numVal = Number(val);
                        if (!isNaN(numVal)) item.durationSec = numVal * 24 * 3600;
                    }
                }
                
                // Обробка кількості ЕН
                item.eh = 0;
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
        groupDiv.innerHTML = `<h5>${col}</h5><div class="filter-list" id="filter_list_${col}"></div>`;

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
            label.className = 'slicer-btn';
            label.innerHTML = `
                <input type="checkbox" value="${opt}" data-column="${col}" class="dynamic-checkbox">
                <span class="slicer-text">${opt}</span>
            `;
            
            // Логіка підсвічування кнопки та запуску фільтрації
            const input = label.querySelector('input');
            input.addEventListener('change', (e) => {
                if(e.target.checked) label.classList.add('active');
                else label.classList.remove('active');
                drawLogisticsMap();
            });
            
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

    // 1. Збираємо поточні вибрані фільтри
    let activeFilters = {};
    document.querySelectorAll('.dynamic-checkbox:checked').forEach(cb => {
        const col = cb.getAttribute('data-column');
        if (!activeFilters[col]) activeFilters[col] = [];
        activeFilters[col].push(cb.value);
    });

    // 2. КАСКАДНІ ФІЛЬТРИ (Слайсери)
    filterableColumns.forEach(targetCol => {
        const subset = cachedData.filter(item => {
            for (const col in activeFilters) {
                if (col === targetCol) continue; 
                if (activeFilters[col].length > 0 && !activeFilters[col].includes(item.rawData[col])) {
                    return false;
                }
            }
            return true;
        });

        const validValues = new Set(subset.map(item => item.rawData[targetCol]));
        let filterChanged = false;

        document.querySelectorAll(`.dynamic-checkbox[data-column="${targetCol}"]`).forEach(cb => {
            const label = cb.closest('.slicer-btn');
            if (validValues.has(cb.value)) {
                label.style.display = ''; 
            } else {
                label.style.display = 'none'; 
                if (cb.checked) {
                    cb.checked = false;
                    label.classList.remove('active');
                    filterChanged = true;
                }
            }
        });
        
        if (filterChanged) {
            activeFilters[targetCol] = Array.from(document.querySelectorAll(`.dynamic-checkbox[data-column="${targetCol}"]:checked`)).map(cb => cb.value);
        }
    });

    // 3. Фільтруємо масив даних
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

    // 4. --- ЛОГІКА "ХАБ-ФІЛІЯ" ---
    const selectedCitiesA = activeFilters['ФРД А'] || [];
    const selectedCitiesB = activeFilters['ФРД Б'] || [];
    const isFilAFiltered = activeFilters['Філія А'] && activeFilters['Філія А'].length > 0;
    const isFilBFiltered = activeFilters['Філія Б'] && activeFilters['Філія Б'].length > 0;
    
    const isHubMode = selectedCitiesA.length > 0 && selectedCitiesB.length > 0;

    const routeGroups = {};
    const distGroups = {}; 

    filteredData.forEach(item => {
        let currentLatA, currentLngA, currentLatB, currentLngB, currentCityA, currentCityB;

        if (isHubMode) {
            // ВІДПРАВНИК (А): Дозволяємо явно вибраній філії перекривати Хаб
            currentLatA = (isFilAFiltered && item.latFilA && !isNaN(item.latFilA)) ? item.latFilA : item.latA;
            currentLngA = (isFilAFiltered && item.lngFilA && !isNaN(item.lngFilA)) ? item.lngFilA : item.lngA;
            currentCityA = (isFilAFiltered && item.rawData['Філія А']) ? item.rawData['Філія А'] : item.cityA;

            // ОТРИМУВАЧ (Б): Завжди йдемо в Хаб, а звідти малюємо дистрибуцію
            currentLatB = item.latB;
            currentLngB = item.lngB;
            currentCityB = item.cityB;

            // Лінії розвозки для Отримувача
            if (item.latFilB && item.lngFilB && !isNaN(item.latFilB)) {
                const distKey = `${currentLatB}_${currentLngB}_${item.latFilB}_${item.lngFilB}`;
                if (!distGroups[distKey]) {
                    distGroups[distKey] = {
                        from: [currentLatB, currentLngB],
                        to: [item.latFilB, item.lngFilB],
                        name: item.rawData['Філія Б'] || "Філія",
                        parentHub: item.cityB,
                        totalEH: 0, totalFundSec: 0, sumDurationSec: 0, count: 0
                    };
                }
                distGroups[distKey].totalEH += item.eh;
                distGroups[distKey].totalFundSec += (item.durationSec * item.eh);
                distGroups[distKey].sumDurationSec += item.durationSec;
                distGroups[distKey].count += 1;
            }
        } else {
            // Звичайний режим
            currentLatA = (isFilAFiltered && item.latFilA && !isNaN(item.latFilA)) ? item.latFilA : item.latA;
            currentLngA = (isFilAFiltered && item.lngFilA && !isNaN(item.lngFilA)) ? item.lngFilA : item.lngA;
            currentLatB = (isFilBFiltered && item.latFilB && !isNaN(item.latFilB)) ? item.latFilB : item.latB;
            currentLngB = (isFilBFiltered && item.lngFilB && !isNaN(item.lngFilB)) ? item.lngFilB : item.lngB;
            currentCityA = (isFilAFiltered && item.rawData['Філія А']) ? item.rawData['Філія А'] : item.cityA;
            currentCityB = (isFilBFiltered && item.rawData['Філія Б']) ? item.rawData['Філія Б'] : item.cityB;
        }

        const routeKey = `${currentLatA}_${currentLngA}_${currentLatB}_${currentLngB}`;
        if (!routeGroups[routeKey]) {
            routeGroups[routeKey] = {
                latA: currentLatA, lngA: currentLngA, latB: currentLatB, lngB: currentLngB,
                cityA: currentCityA, cityB: currentCityB,
                totalEH: 0, totalFundSec: 0, sumDurationSec: 0, count: 0
            };
        }
        routeGroups[routeKey].totalEH += item.eh;
        routeGroups[routeKey].totalFundSec += (item.durationSec * item.eh);
        routeGroups[routeKey].sumDurationSec += item.durationSec;
        routeGroups[routeKey].count += 1;
    });

    const groupedData = Object.values(routeGroups).map(group => {
        let avgDurationSec = group.totalEH > 0 ? group.totalFundSec / group.totalEH : group.sumDurationSec / group.count;
        let metricsArray = [];
        if (showTime && avgDurationSec > 0) {
            const h = Math.floor(avgDurationSec / 3600);
            const m = Math.floor((avgDurationSec % 3600) / 60);
            const s = Math.round(avgDurationSec % 60);
            metricsArray.push(`${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        }
        if (showEH && group.totalEH > 0) { metricsArray.push(`${Math.round(group.totalEH)} ЕН`); }
        group.metricsHtml = metricsArray.join(' | ');
        return group;
    });

    const distLinesData = Object.values(distGroups).map(group => {
        let avgDurationSec = group.totalEH > 0 ? group.totalFundSec / group.totalEH : group.sumDurationSec / group.count;
        let metricsArray = [];
        if (showTime && avgDurationSec > 0) {
            const h = Math.floor(avgDurationSec / 3600);
            const m = Math.floor((avgDurationSec % 3600) / 60);
            const s = Math.round(avgDurationSec % 60);
            metricsArray.push(`${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        }
        if (showEH && group.totalEH > 0) { metricsArray.push(`${Math.round(group.totalEH)} ЕН`); }
        group.metricsHtml = metricsArray.join(' | ');
        return group;
    });

    const drawnCities = new Set(); 
    
    const uniqueSenders = new Set();
    const uniqueReceivers = new Set();
    groupedData.forEach(item => { uniqueSenders.add(item.cityA); uniqueReceivers.add(item.cityB); });

    let labelOffset = 0.5; 
    if (uniqueSenders.size < uniqueReceivers.size) labelOffset = 0.75; 
    else if (uniqueSenders.size > uniqueReceivers.size) labelOffset = 0.25; 

    // Спільна функція для малювання маркера міст/хабів (ЗАХИСТ ВІД ДУБЛІВ)
    const drawCityMarker = (lat, lng, name, isHub) => {
        const cityId = `${lat}_${lng}`; 
        if (!drawnCities.has(cityId)) {
            L.circleMarker([lat, lng], { 
                radius: isHub ? Math.max(weight + 3, 6) : Math.max(weight + 1, 4), 
                color: '#fff', weight: 1, fillColor: color, fillOpacity: 1 
            }).bindTooltip(name, { 
                permanent: showCityNames, direction: 'top', offset: [0, -10], 
                className: showCityNames ? 'city-label-tooltip' : '' 
            }).addTo(markersLayerGroup);
            drawnCities.add(cityId); 
        }
    };

    if (isRadarSequence) {
        groupedData.forEach(item => {
            const cityIdA = `${item.latA}_${item.lngA}`;
            if (!drawnCities.has(cityIdA)) {
                L.circleMarker([item.latA, item.lngA], { radius: isHubMode ? Math.max(weight + 3, 6) : Math.max(weight + 1, 4), color: '#fff', weight: 1, fillColor: color, fillOpacity: 1 })
                .bindTooltip(item.cityA, { permanent: showCityNames, direction: 'top', offset: [0, -10], className: showCityNames ? 'city-label-tooltip' : '' }).addTo(markersLayerGroup);
                drawnCities.add(cityIdA);
            }
            item.angle = Math.atan2(item.lngB - item.lngA, item.latB - item.latA);
        });
        groupedData.sort((a, b) => a.angle - b.angle);

        let i = 0;
        const tick = () => {
            const item = groupedData[i];
            const tempGroup = L.layerGroup().addTo(sequenceLayerGroup);
            const latlngA = L.latLng(item.latA, item.lngA);
            const latlngB = L.latLng(item.latB, item.lngB);

            L.polyline([latlngA, latlngB], { color: color, weight: isHubMode ? weight + 2 : weight, className: 'radar-fade' }).addTo(tempGroup);
            if (isAnimated) L.polyline([latlngA, latlngB], { color: '#ffffff', weight: Math.max(1, weight - 1), dashArray: '15, 85', className: 'animated-flow radar-fade' }).addTo(tempGroup);

            if (item.metricsHtml !== "") {
                const pA = map.project(latlngA, 0); const pB = map.project(latlngB, 0);
                const targetPoint = map.unproject(L.point(pA.x + (pB.x - pA.x) * labelOffset, pA.y + (pB.y - pA.y) * labelOffset), 0);
                let textAngle = Math.atan2(pB.y - pA.y, pB.x - pA.x) * (180 / Math.PI);
                if (pB.x < pA.x) textAngle += 180;
                const labelIcon = L.divIcon({ className: 'rotated-label-container radar-fade', html: `<div class="rotated-label-content" style="transform: translate(-50%, -50%) rotate(${textAngle}deg) translateY(-20px); border-color: ${color};">${item.metricsHtml}</div>`, iconSize: [0, 0] });
                L.marker(targetPoint, { icon: labelIcon }).addTo(tempGroup);
            }

            L.circleMarker([item.latB, item.lngB], { radius: isHubMode ? Math.max(weight + 3, 6) : Math.max(weight + 1, 4), color: '#fff', weight: 1, fillColor: color, className: 'radar-fade' })
            .bindTooltip(item.cityB, { permanent: showCityNames, direction: 'top', offset: [0, -10], className: showCityNames ? 'city-label-tooltip radar-fade' : 'radar-fade' }).addTo(tempGroup);

            if (isHubMode) {
                const branches = distLinesData.filter(dl => dl.parentHub === item.cityB);
                branches.forEach(line => {
                    L.polyline([line.from, line.to], { color: color, weight: Math.max(1, weight - 1), opacity: 0.6, dashArray: '5, 5', className: 'radar-fade' }).addTo(tempGroup);
                    L.circleMarker(line.to, { radius: 3, color: color, fillColor: '#fff', fillOpacity: 1, className: 'radar-fade' })
                     .bindTooltip(line.name, { permanent: showCityNames, direction: 'top', offset: [0, -5], className: showCityNames ? 'city-label-tooltip radar-fade' : 'radar-fade' }).addTo(tempGroup);
                    
                    if (line.metricsHtml !== "") {
                        const pA = map.project(L.latLng(line.from), 0); const pB = map.project(L.latLng(line.to), 0);
                        const tPoint = map.unproject(L.point(pA.x + (pB.x - pA.x) * 0.6, pA.y + (pB.y - pA.y) * 0.6), 0);
                        let ang = Math.atan2(pB.y - pA.y, pB.x - pA.x) * (180 / Math.PI);
                        if (pB.x < pA.x) ang += 180;
                        const lblIcon = L.divIcon({ className: 'rotated-label-container radar-fade', html: `<div class="rotated-label-content" style="transform: translate(-50%, -50%) rotate(${ang}deg) translateY(-12px); border-color: ${color}; font-size: 0.6rem; padding: 1px 4px;">${line.metricsHtml}</div>`, iconSize: [0, 0] });
                        L.marker(tPoint, { icon: lblIcon }).addTo(tempGroup);
                    }
                });
            }

            setTimeout(() => { if (map.hasLayer(sequenceLayerGroup) && sequenceLayerGroup.hasLayer(tempGroup)) sequenceLayerGroup.removeLayer(tempGroup); }, 1100);
            i = (i + 1) % groupedData.length; 
        };
        tick(); 
        sequentialInterval = setInterval(tick, 100);
        statusDiv.innerHTML = `Режим радару: <span style="color:#38bdf8">${groupedData.length}</span> напрямків`;

    } else {
        // СТАТИЧНА ВІДМАЛЬОВКА
        groupedData.forEach(item => {
            const latlngA = L.latLng(item.latA, item.lngA); 
            const latlngB = L.latLng(item.latB, item.lngB);
            
            L.polyline([latlngA, latlngB], { color: color, weight: isHubMode ? weight + 2 : weight, opacity: isAnimated ? 0.3 : 0.6 }).addTo(linesLayerGroup);
            if (isAnimated) L.polyline([latlngA, latlngB], { color: '#ffffff', weight: Math.max(1, weight - 1), opacity: 0.8, dashArray: '15, 85', className: 'animated-flow' }).addTo(linesLayerGroup);

            if (item.metricsHtml !== "") {
                const pA = map.project(latlngA, 0); const pB = map.project(latlngB, 0);
                const targetPoint = map.unproject(L.point(pA.x + (pB.x - pA.x) * labelOffset, pA.y + (pB.y - pA.y) * labelOffset), 0);
                let angle = Math.atan2(pB.y - pA.y, pB.x - pA.x) * (180 / Math.PI);
                if (pB.x < pA.x) angle += 180;
                const labelIcon = L.divIcon({ className: 'rotated-label-container', html: `<div class="rotated-label-content" style="transform: translate(-50%, -50%) rotate(${angle}deg) translateY(-20px); border-color: ${color};">${item.metricsHtml}</div>`, iconSize: [0, 0] });
                L.marker(targetPoint, { icon: labelIcon }).addTo(linesLayerGroup);
            }

            // Малюємо міста/хаби (із записом у drawnCities)
            drawCityMarker(item.latA, item.lngA, item.cityA, isHubMode);
            drawCityMarker(item.latB, item.lngB, item.cityB, isHubMode);
        });

        if (isHubMode) {
            distLinesData.forEach(line => {
                L.polyline([line.from, line.to], { color: color, weight: Math.max(1, weight - 1), opacity: 0.5, dashArray: '5, 5' }).addTo(linesLayerGroup);
                
                // ЗАХИСТ ВІД ДУБЛЮВАННЯ ДЛЯ ФІЛІЙ
                const branchId = `${line.to[0]}_${line.to[1]}`;
                if (!drawnCities.has(branchId)) {
                    L.circleMarker(line.to, { radius: 3, color: color, fillColor: '#fff', fillOpacity: 1 })
                        .bindTooltip(line.name, { permanent: showCityNames, className: 'city-label-tooltip', direction: 'top', offset: [0, -5] })
                        .addTo(markersLayerGroup);
                    drawnCities.add(branchId);
                }
                
                if (line.metricsHtml !== "") {
                    const pA = map.project(L.latLng(line.from), 0); const pB = map.project(L.latLng(line.to), 0);
                    const tPoint = map.unproject(L.point(pA.x + (pB.x - pA.x) * 0.6, pA.y + (pB.y - pA.y) * 0.6), 0); 
                    let ang = Math.atan2(pB.y - pA.y, pB.x - pA.x) * (180 / Math.PI);
                    if (pB.x < pA.x) ang += 180;
                    
                    const lblIcon = L.divIcon({ className: 'rotated-label-container', html: `<div class="rotated-label-content" style="transform: translate(-50%, -50%) rotate(${ang}deg) translateY(-12px); border-color: ${color}; font-size: 0.6rem; padding: 1px 4px;">${line.metricsHtml}</div>`, iconSize: [0, 0] });
                    L.marker(tPoint, { icon: lblIcon }).addTo(linesLayerGroup);
                }
            });
        }

        statusDiv.innerHTML = `Показано напрямків: <span style="color:#38bdf8">${groupedData.length}</span>`;
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