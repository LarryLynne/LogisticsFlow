const lightMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OSM', maxZoom: 19, crossOrigin: true });
const darkMap = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; CartoDB', maxZoom: 20, crossOrigin: true });
const satelliteMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '&copy; Esri', maxZoom: 18, crossOrigin: true });

const map = L.map('map', { 
    center: [48.37, 31.16], 
    zoom: 6, 
    layers: [lightMap],
    zoomSnap: 0.1,        
    zoomDelta: 0.5,       
    wheelPxPerZoomLevel: 120 
});
const baseMaps = { "Світла": lightMap, "Темна": darkMap,  "Супутник": satelliteMap };
L.control.layers(baseMaps, null, {position: 'topright'}).addTo(map);

// --- ГРАНИЦЫ УКРАИНЫ С НАСТРОЙКОЙ ---
let ukraineLayer = null; 

function loadUkraineBounds() {
    const ukraineGeoJsonUrl = 'https://raw.githubusercontent.com/johan/world.geo.json/master/countries/UKR.geo.json';
    const selectedColor = document.getElementById('borderColorSelect').value;

    fetch(ukraineGeoJsonUrl)
        .then(response => response.json())
        .then(data => {
            if (ukraineLayer) map.removeLayer(ukraineLayer);
            
            ukraineLayer = L.layerGroup().addTo(map);

            const glowLayers = [
                { weight: 24, opacity: 0.02 },
                { weight: 16, opacity: 0.05 },
                { weight: 10, opacity: 0.1 },
                { weight: 6,  opacity: 0.2 }
            ];

            glowLayers.forEach(glow => {
                L.geoJSON(data, {
                    style: {
                        color: selectedColor,
                        weight: glow.weight,
                        opacity: glow.opacity,
                        fill: false, 
                        lineJoin: 'round',
                        lineCap: 'round'
                    },
                    interactive: false
                }).addTo(ukraineLayer);
            });

            L.geoJSON(data, {
                style: {
                    stroke: false, 
                    fillColor: selectedColor,
                    fillOpacity: 0.03
                },
                interactive: false
            }).addTo(ukraineLayer);

            L.geoJSON(data, {
                style: {
                    color: selectedColor,
                    weight: 2,
                    opacity: 1,
                    fill: false,
                    lineJoin: 'round',
                    lineCap: 'round'
                },
                interactive: false
            }).addTo(ukraineLayer);
        })
        .catch(err => console.error("Не удалось загрузить границы:", err));
}
loadUkraineBounds();

document.getElementById('borderColorSelect').addEventListener('change', loadUkraineBounds);

const screenshoter = L.simpleMapScreenshoter({ hidden: true, mimeType: 'image/png' }).addTo(map);

const linesLayerGroup = L.layerGroup().addTo(map);
const markersLayerGroup = L.layerGroup().addTo(map);

let cachedData = []; 
let selectedDate = null; 

const weightInput = document.getElementById('weightRange');
const colorSelect = document.getElementById('colorSelect');
const labelsToggle = document.getElementById('alwaysShowLabels');
const cityLabelsToggle = document.getElementById('showCityLabels'); 
const animateToggle = document.getElementById('animateFlow');
const statusDiv = document.getElementById('status');
const uploadLabel = document.getElementById('uploadLabel');
const snapBtn = document.getElementById('snapBtn');
const dateFiltersContainer = document.getElementById('dateFiltersContainer');
const dateChipsDiv = document.getElementById('dateChips');
const cityFiltersContainer = document.getElementById('cityFiltersContainer');

function formatSmartValue(val) {
    if (val === null || val === undefined) return '';
    const num = Number(val);
    if (isNaN(num)) return val; 
    const strVal = String(val);
    if (strVal.includes('.')) {
        const decimals = strVal.split('.')[1];
        if (decimals.length >= 5 && num >= 0 && num <= 1000) {
            const totalSeconds = Math.round(num * 24 * 3600);
            const h = Math.floor(totalSeconds / 3600);
            const m = Math.floor((totalSeconds % 3600) / 60);
            const s = totalSeconds % 60;
            return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        return parseFloat(num.toFixed(2));
    }
    return num;
}

function formatExcelDate(val) {
    const numVal = Number(val);
    if (!isNaN(numVal) && numVal > 30000 && numVal < 100000) {
        const date = new Date(Math.round((numVal - 25569) * 86400 * 1000));
        return date.toLocaleDateString('ru-RU');
    }
    return String(val); 
}

document.getElementById('fileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    uploadLabel.innerHTML = `⏳ Чтение...`;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            processData(jsonData, file.name);
        } catch (err) {
            statusDiv.innerHTML = "<span style='color:#ef4444'>Ошибка файла</span>";
            uploadLabel.innerHTML = "📂 Загрузить файл";
        }
    };
    reader.readAsArrayBuffer(file);
});

function processData(data, filename) {
    cachedData = [];
    selectedDate = null;
    const uniqueDates = new Set();
    const uniqueCityA = new Set();
    const uniqueCityB = new Set();
    let bounds = new L.LatLngBounds();

    data.forEach(row => {
        const keys = Object.keys(row);
        const latAKey = keys.find(k => /широта.*а|lat.*a/i.test(k));
        const lngAKey = keys.find(k => /довгота.*а|долгота.*а|lon.*a|lng.*a/i.test(k));
        const latBKey = keys.find(k => /широта.*б|lat.*b/i.test(k));
        const lngBKey = keys.find(k => /довгота.*б|долгота.*б|lon.*b|lng.*b/i.test(k));
        const cityAKey = keys.find(k => /ФРД.*а|город.*а|city.*a/i.test(k));
        const cityBKey = keys.find(k => /ФРД.*б|город.*б|city.*b/i.test(k));
        const dateKey = keys.find(k => /дата|date/i.test(k)); 

        if (latAKey && lngAKey && latBKey && lngBKey) {
            const latA = parseFloat(row[latAKey]);
            const lngA = parseFloat(row[lngAKey]);
            const latB = parseFloat(row[latBKey]);
            const lngB = parseFloat(row[lngBKey]);

            if (!isNaN(latA) && !isNaN(lngA) && !isNaN(latB) && !isNaN(lngB)) {
                
                let metricsArray = [];
                const excludeKeys = [latAKey, lngAKey, latBKey, lngBKey, cityAKey, cityBKey, dateKey];
                
                keys.forEach(k => {
                    if (!excludeKeys.includes(k) && row[k] !== undefined && row[k] !== '') {
                        const formattedVal = formatSmartValue(row[k]);
                        metricsArray.push(`${formattedVal}`);
                    }
                });
                
                let metricsHtml = metricsArray.join(' &nbsp;|&nbsp; ');

                const rowDate = dateKey ? formatExcelDate(row[dateKey]) : null;
                if (rowDate) uniqueDates.add(rowDate);

                const cA = cityAKey ? String(row[cityAKey]) : "Точка А";
                const cB = cityBKey ? String(row[cityBKey]) : "Точка Б";
                
                uniqueCityA.add(cA);
                uniqueCityB.add(cB);

                cachedData.push({
                    latA, lngA, latB, lngB,
                    cityA: cA, cityB: cB,
                    date: rowDate,
                    metricsHtml: metricsHtml
                });
                bounds.extend([latA, lngA]);
                bounds.extend([latB, lngB]);
            }
        }
    });

    if (cachedData.length > 0) {
        renderDateFilters(Array.from(uniqueDates).sort());
        renderCityFilters(Array.from(uniqueCityA), Array.from(uniqueCityB));
        drawLogisticsMap();
        map.fitBounds(bounds, { padding: [50, 50] });
        
        uploadLabel.innerHTML = `✅ ${filename}`;
        uploadLabel.style.background = "linear-gradient(135deg, #10b981, #059669)";
        uploadLabel.style.color = "white";
    } else {
        statusDiv.innerHTML = "<span style='color:#ef4444'>Колонки координат не найдены</span>";
    }
}

function renderDateFilters(dates) {
    dateChipsDiv.innerHTML = "";
    if (dates.length === 0) {
        dateFiltersContainer.style.display = "none";
        return;
    }
    dateFiltersContainer.style.display = "block";

    const allBtn = document.createElement('div');
    allBtn.className = "date-chip active";
    allBtn.innerText = "Все";
    allBtn.onclick = () => {
        document.querySelectorAll('.date-chip').forEach(c => c.classList.remove('active'));
        allBtn.classList.add('active');
        selectedDate = null;
        drawLogisticsMap();
    };
    dateChipsDiv.appendChild(allBtn);

    dates.forEach(date => {
        const chip = document.createElement('div');
        chip.className = "date-chip";
        chip.innerText = date;
        chip.onclick = () => {
            document.querySelectorAll('.date-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            selectedDate = date;
            drawLogisticsMap();
        };
        dateChipsDiv.appendChild(chip);
    });
}

function renderCityFilters(citiesA, citiesB) {
    const listA = document.getElementById('cityA_list');
    const listB = document.getElementById('cityB_list');

    if (citiesA.length === 0 && citiesB.length === 0) {
        cityFiltersContainer.style.display = "none";
        return;
    }
    cityFiltersContainer.style.display = "block";
    listA.innerHTML = '';
    listB.innerHTML = '';

    citiesA.sort().forEach(city => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${city}" class="filter-city-a"> ${city}`;
        label.querySelector('input').addEventListener('change', drawLogisticsMap);
        listA.appendChild(label);
    });

    citiesB.sort().forEach(city => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${city}" class="filter-city-b"> ${city}`;
        label.querySelector('input').addEventListener('change', drawLogisticsMap);
        listB.appendChild(label);
    });
}

function drawLogisticsMap() {
    linesLayerGroup.clearLayers();
    markersLayerGroup.clearLayers();
    if (cachedData.length === 0) return;

    const weight = parseInt(weightInput.value);
    const color = colorSelect.value;
    const showLabels = labelsToggle.checked;
    const showCityNames = cityLabelsToggle.checked; 
    const isAnimated = animateToggle.checked

    document.getElementById('weightVal').textContent = weight;

    const selectedA = Array.from(document.querySelectorAll('.filter-city-a:checked')).map(cb => cb.value);
    const selectedB = Array.from(document.querySelectorAll('.filter-city-b:checked')).map(cb => cb.value);

    const totalA = document.querySelectorAll('.filter-city-a').length;
    const totalB = document.querySelectorAll('.filter-city-b').length;

    const activeCountA = selectedA.length > 0 ? selectedA.length : totalA;
    const activeCountB = selectedB.length > 0 ? selectedB.length : totalB;

    let labelOffset = 0.5; 

    if (activeCountA < activeCountB) {
        labelOffset = 0.75; 
    } else if (activeCountB < activeCountA) {
        labelOffset = 0.25; 
    }

    const filteredData = cachedData.filter(d => {
        let passDate = selectedDate ? d.date === selectedDate : true;
        let passA = selectedA.length > 0 ? selectedA.includes(d.cityA) : true;
        let passB = selectedB.length > 0 ? selectedB.includes(d.cityB) : true;
        return passDate && passA && passB;
    });

    const drawnCities = new Set(); 

    filteredData.forEach(item => {
        const latlngA = L.latLng(item.latA, item.lngA);
        const latlngB = L.latLng(item.latB, item.lngB);

        L.polyline([latlngA, latlngB], { 
            color: color, 
            weight: weight, 
            opacity: isAnimated ? 0.3 : 0.6 
        }).addTo(linesLayerGroup);

        if (isAnimated) {
            L.polyline([latlngA, latlngB], { 
                color: '#ffffff',
                weight: Math.max(1, weight - 1),
                opacity: 0.8,
                dashArray: '15, 85',
                className: 'animated-flow'
            }).addTo(linesLayerGroup);
        }

        if (item.metricsHtml !== "" && showLabels) {
            const pA = map.project(latlngA, 0);
            const pB = map.project(latlngB, 0);

            const targetX = pA.x + (pB.x - pA.x) * labelOffset;
            const targetY = pA.y + (pB.y - pA.y) * labelOffset;
            const targetPoint = map.unproject(L.point(targetX, targetY), 0);
            let angle = Math.atan2(pB.y - pA.y, pB.x - pA.x) * (180 / Math.PI);
            if (pB.x < pA.x) angle += 180;

            const labelIcon = L.divIcon({
                className: 'rotated-label-container',
                html: `<div class="rotated-label-content" style="transform: translate(-50%, -50%) rotate(${angle}deg) translateY(-20px); border-color: ${color};">${item.metricsHtml}</div>`,
                iconSize: [0, 0]
            });
            L.marker(targetPoint, { icon: labelIcon }).addTo(linesLayerGroup);
        }

        const drawCityMarker = (lat, lng, name) => {
            const cityId = `${lat}_${lng}`; 
            if (!drawnCities.has(cityId)) {
                L.circleMarker([lat, lng], { radius: Math.max(weight + 1, 4), color: '#fff', weight: 1, fillColor: color, fillOpacity: 1 })
                .bindTooltip(name, { 
                    permanent: showCityNames, 
                    direction: 'top', 
                    offset: [0, -10],
                    className: showCityNames ? 'city-label-tooltip' : '' 
                })
                .addTo(markersLayerGroup);
                drawnCities.add(cityId); 
            }
        };
        drawCityMarker(item.latA, item.lngA, item.cityA);
        drawCityMarker(item.latB, item.lngB, item.cityB);
    });

    statusDiv.innerHTML = `Показано зв'язків: <span style="color:#38bdf8">${filteredData.length}</span> из ${cachedData.length}`;
}

snapBtn.addEventListener('click', function() {
    const originalText = snapBtn.textContent;
    snapBtn.textContent = "⏳ Створення знімку...";
    screenshoter.takeScreen('blob').then(blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `logistics_export_${new Date().getTime()}.png`;
        link.click();
        snapBtn.textContent = originalText;
    }).catch(e => {
        console.error(e);
        alert("Помилка. Можливо, браузер блокує завантаження мапи.");
        snapBtn.textContent = originalText;
    });
});

weightInput.addEventListener('input', drawLogisticsMap);
colorSelect.addEventListener('change', drawLogisticsMap);
labelsToggle.addEventListener('change', drawLogisticsMap);
cityLabelsToggle.addEventListener('change', drawLogisticsMap); 
animateToggle.addEventListener('change', drawLogisticsMap);