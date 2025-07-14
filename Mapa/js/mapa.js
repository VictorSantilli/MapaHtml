const andarSelect = document.getElementById('andarSelect');
const categoriaSelect = document.getElementById('categoriaSelect');
const sidebar = document.getElementById('sidebar');
const menuBtn = document.getElementById('menuBtn');
const btnCloseSideBar = document.getElementById('closeSidebar')
const navegarBtn = document.getElementById('navegarBtn');


function openSidebar() {
    sidebar.classList.add('open');
}
function closeSidebar() {
    sidebar.classList.remove('open');
}

    sidebar.classList.toggle('open');

    if (sidebar.classList.contains('open')) {
        // Esconde o botão ao abrir a sidebar
        menuBtn.classList.add('d-none');
        desenharAndar(currentAndarIdx);
    }
};
btnCloseSideBar.onclick = () => {
    closeSidebar();
    if (window.innerWidth <= 600) {
        menuBtn.classList.remove('d-none'); // Mostra o botão ao fechar
    }
};

// Abre sidebar automaticamente em desktop
if (window.innerWidth > 600) openSidebar();


// Fecha sidebar ao navegar (mobile)
document.getElementById('navegarBtn').onclick = function () {
    // ...existing code...
    if (window.innerWidth <= 600) closeSidebar();
};


document.getElementById('navegarBtn').onclick = () => {
    const origemNome = document.getElementById('origem').value;
    const destinoNome = document.getElementById('destino').value;
    const areasAndar = andares[currentAndarIdx].areas;
    const areaOrigem = areasAndar.find(a => a.nome === origemNome);
    const areaDestino = areasAndar.find(a => a.nome === destinoNome);
    if (!areaOrigem || !areaDestino) {
        alert('Selecione áreas válidas para origem e destino!');
        return;
    }
    const coordOrigem = areaOrigem.label;
    const coordDestino = areaDestino.label;
    const caminho = buscarCaminho(coordOrigem, coordDestino);
    destacarCaminho(caminho);
};

// Inicializa o mapa sem camada base
const map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -5
});

let overlayImg = null;
let areaObjs = [], labelObjs = [], polyObjs = {};
let currentAndarIdx = 0;
let currentGraph = null, currentNodes = null, currentSegmentos = null;
let labelMarkers = [];
const LABEL_ZOOM_THRESHOLD = 0; // ajuste conforme necessário
let routeMarkers = [];
let categoriaMarkers = [];

function desenharAndar(idx) {
    const andar = andares[idx];
    currentAndarIdx = Number(idx);
    currentSegmentos = andar.segmentos;
    currentNodes = getUniqueNodes(currentSegmentos);
    currentGraph = buildGraph(currentSegmentos, currentNodes);
    // Remove overlays anteriores
    if (overlayImg) map.removeLayer(overlayImg);
    overlayImg = L.imageOverlay(andar.imagem, andar.bounds).addTo(map);
    // Remove áreas e labels anteriores
    areaObjs.forEach(a => map.removeLayer(a));
    labelObjs.forEach(l => map.removeLayer(l));
    Object.values(polyObjs).forEach(p => map.removeLayer(p));
    areaObjs = []; labelObjs = []; polyObjs = {}; labelMarkers = [];
    // Desenha áreas
    andar.areas.forEach((a, i) => {
        let area, label;
        if (a.tipo === 'rectangle') {
            area = L.rectangle(a.coord, { color: 'transparent', weight: 3, fillColor: a.cor, fillOpacity: 0.5 }).addTo(map);
        } else if (a.tipo === 'circle') {
            area = L.circle(a.coord, { radius: a.raio, color: 'transparent', weight: 3, fillColor: a.cor, fillOpacity: 0.5 }).addTo(map);
        } else if (a.tipo === 'polygon') {
            area = L.polygon(a.coord, { color: 'transparent', weight: 3, fillColor: a.cor, fillOpacity: 0.5 }).addTo(map);
        } else if (a.tipo === 'escada' || a.tipo === 'elevador') {
            // Desenha escada/elevador como círculo cinza
            area = L.circle(a.coord, { radius: a.raio || 40, color: 'gray', weight: 2, fillColor: a.cor || '#cccccc', fillOpacity: 0.7 }).addTo(map);
        }
        if (area) {
            area.on('click', function () {
                areaObjs.forEach(a2 => a2.setStyle({ color: 'transparent' }));
                area.setStyle({ color: 'red' });
                map.setView(a.label, map.getZoom(), { animate: true });
                L.popup({ className: 'custom-popup' })
                    .setLatLng(a.label)
                    .setContent(`
                              <div class="popup-content">
                                <img src="${a.icon}" class="popup-icon" alt="Ícone">
                                <div><b>${a.nome}</b><br>${a.popup || ''}<br>
                                  <span class="popup-rota" style="color:#0070d1;cursor:pointer;font-weight:bold;">ROTA</span>
                                </div>
                              </div>
                            `)
                    .openOn(map);
                // Adiciona ação ao texto ROTA
                setTimeout(() => {
                    const rotaEl = document.querySelector('.popup-rota');
                    if (rotaEl) {
                        rotaEl.onclick = function () {
                            document.getElementById('destino').value = `${a.nome} [${andares[currentAndarIdx].nome}]`;
                            document.getElementById('destino').dispatchEvent(new Event('input'));
                            L.popup().remove();
                        };
                    }
                }, 100);
            });
            areaObjs.push(area);
        }
        label = L.marker(a.label, {
            icon: L.divIcon({ className: 'label', html: `<b>${a.nome}</b>`, iconSize: [80, 20] }),
            interactive: false
        });
        labelMarkers.push(label);
    });
    // Desenha segmentos (inicialmente invisíveis)
    andar.segmentos.forEach(seg => {
        const poly = L.polyline([seg.a, seg.b], {
            color: '#bbb', weight: 4, opacity: 0, interactive: false
        }).addTo(map);
        polyObjs[seg.id] = poly;
    });
    updateLabelsVisibility();
}

function updateLabelsVisibility() {
    const show = map.getZoom() >= LABEL_ZOOM_THRESHOLD;
    labelMarkers.forEach(label => {
        if (show) {
            if (!map.hasLayer(label)) label.addTo(map);
        } else {
            if (map.hasLayer(label)) map.removeLayer(label);
        }
    });
}

map.on('zoomend', updateLabelsVisibility);

andarSelect.onchange = function () {
    // Remove tudo do mapa antes de desenhar o novo andar
    if (overlayImg) map.removeLayer(overlayImg);
    areaObjs.forEach(a => map.removeLayer(a));
    labelObjs.forEach(l => map.removeLayer(l));
    Object.values(polyObjs).forEach(p => map.removeLayer(p));
    areaObjs = []; labelObjs = []; polyObjs = {};
    desenharAndar(this.value);
};
desenharAndar(0);

// Funções de navegação para o andar selecionado
function dist(a, b) {
    return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
}
function getUniqueNodes(segmentos) {
    const nodes = [];
    segmentos.forEach(seg => {
        if (!nodes.some(n => n[0] === seg.a[0] && n[1] === seg.a[1])) nodes.push(seg.a);
        if (!nodes.some(n => n[0] === seg.b[0] && n[1] === seg.b[1])) nodes.push(seg.b);
    });
    return nodes;
}
function buildGraph(segmentos, nodes) {
    const graph = {};
    nodes.forEach(n => graph[nodeKey(n)] = []);
    segmentos.forEach(seg => {
        const aKey = nodeKey(seg.a);
        const bKey = nodeKey(seg.b);
        const custo = dist(seg.a, seg.b);
        graph[aKey].push({ to: bKey, segId: seg.id, custo });
        graph[bKey].push({ to: aKey, segId: seg.id, custo });
    });
    return graph;
}
function nodeKey(pt) { return pt[0] + ',' + pt[1]; }
function nearestNode(pt, nodes) {
    let min = Infinity, nearest = null;
    nodes.forEach(n => {
        const d = dist(pt, n);
        if (d < min) { min = d; nearest = n; }
    });
    return nearest;
}

function convertImageCoordsToLeaflet(points, imageHeight) {
    return points.map(([x, y]) => [imageHeight - y, x]);
}
function dijkstra(graph, startKey, endKey, segmentos) {
    const dist = {}, prev = {}, visited = new Set(), queue = [];
    Object.keys(graph).forEach(k => dist[k] = Infinity);
    dist[startKey] = 0;
    queue.push({ key: startKey, dist: 0 });
    while (queue.length) {
        queue.sort((a, b) => a.dist - b.dist);
        const { key } = queue.shift();
        if (visited.has(key)) continue;
        visited.add(key);
        if (key === endKey) break;
        graph[key].forEach(({ to, segId, custo }) => {
            if (visited.has(to)) return;
            const alt = dist[key] + custo;
            if (alt < dist[to]) {
                dist[to] = alt;
                prev[to] = { from: key, segId };
                queue.push({ key: to, dist: alt });
            }
        });
    }
    let path = [];
    let u = endKey;
    while (prev[u]) {
        path.unshift(prev[u].segId);
        u = prev[u].from;
    }
    return path.map(id => currentSegmentos.find(s => s.id === id));
}
function buscarCaminho(origem, destino) {
    const start = nearestNode(origem, currentNodes);
    const end = nearestNode(destino, currentNodes);
    const startKey = nodeKey(start);
    const endKey = nodeKey(end);
    return dijkstra(currentGraph, startKey, endKey, currentSegmentos);
}
function destacarCaminho(caminho, origem, destino) {
    Object.values(polyObjs).forEach(poly => poly.setStyle({ color: '#bbb', opacity: 0 }));
    caminho.forEach(seg => {
        if (polyObjs[seg.id]) {
            polyObjs[seg.id].setStyle({ color: 'orange', opacity: 1, weight: 6 });
            polyObjs[seg.id].bringToFront();
        }
    });
    // Remove pins anteriores
    routeMarkers.forEach(m => map.removeLayer(m));
    routeMarkers = [];
    if (origem) {
        const markerOrigem = L.marker(origem, { title: 'Origem' }).addTo(map);
        routeMarkers.push(markerOrigem);
    }
    if (destino) {
        const markerDestino = L.marker(destino, { title: 'Destino' }).addTo(map);
        routeMarkers.push(markerDestino);
    }
}


// Atualiza o evento do botão navegar para usar o andar atual

navegarBtn.onclick = () => {
    const origemInput = document.getElementById('origem').value;
    const destinoInput = document.getElementById('destino').value;
    const areaOrigem = findAreaByInput(origemInput);
    const areaDestino = findAreaByInput(destinoInput);

    if (!areaOrigem || !areaDestino) {
        alert('Selecione áreas válidas para origem e destino!');
        return;
    }

    if (areaOrigem.andar === areaDestino.andar) {
        // Mesmo andar: caminho direto
        if (currentAndarIdx !== areaOrigem.andar) {
            andarSelect.value = areaOrigem.andar;
            desenharAndar(areaOrigem.andar);
        }
        const caminho = buscarCaminho(areaOrigem.label, areaDestino.label);
        destacarCaminho(caminho, areaOrigem.label, areaDestino.label);
    } else {

        // Andares diferentes: precisa passar por escada/elevador
        const transferOrigem = findNearestTransferArea(areaOrigem.andar, areaOrigem.label);
        const transferDestino = findNearestTransferArea(areaDestino.andar, areaDestino.label);

        if (!transferOrigem || !transferDestino) {
            alert('Não há escada/elevador em um dos andares!');
            return;
        }

        // 1º trecho: andar de origem
        if (currentAndarIdx !== areaOrigem.andar) {
            andarSelect.value = areaOrigem.andar;
            desenharAndar(areaOrigem.andar);
        }
        
        const caminho1 = buscarCaminho(areaOrigem.label, transferOrigem.label);
        destacarCaminho(caminho1, areaOrigem.label, transferOrigem.label);
        // 2º trecho: andar de destino (após pequeno delay para visual)
        // setTimeout(() => {
        //     andarSelect.value = areaDestino.andar;
        //     desenharAndar(areaDestino.andar);
        //     const caminho2 = buscarCaminho(transferDestino.label, areaDestino.label);
        //     destacarCaminho(caminho2, transferDestino.label, areaDestino.label);
        // }, 1200);
    }
};


// Monta lista global de áreas para autocomplete (com andar)
function getAllAreasWithAndar() {
    const all = [];
    andares.forEach((andar, idx) => {
        andar.areas.forEach(area => {
            all.push({
                nome: area.nome,
                andar: idx,
                andarNome: andar.nome,
                tipo: area.tipo,
                label: area.label
            });
        });
    });
    return all;
}

function atualizarDatalistsGlobal() {
    const allAreas = getAllAreasWithAndar();

    const origemDatalist = document.getElementById('origemList');
    const destinoDatalist = document.getElementById('destinoList');
    origemDatalist.innerHTML = '';
    destinoDatalist.innerHTML = '';
    allAreas.forEach(a => {
        const opt1 = document.createElement('option');
        opt1.value = `${a.nome} [${a.andarNome}]`;
        origemDatalist.appendChild(opt1);
        const opt2 = document.createElement('option');
        opt2.value = `${a.nome} [${a.andarNome}]`;
        destinoDatalist.appendChild(opt2);
    });
}
atualizarDatalistsGlobal();

// Preenche datalist de busca lateral
function atualizarDatalistBuscaLateral() {
    const allAreas = getAllAreasWithAndar();
    const buscaList = document.getElementById('areaBuscaList');
    buscaList.innerHTML = '';
    allAreas.forEach(a => {
        const opt = document.createElement('option');
        opt.value = `${a.nome} [${a.andarNome}]`;
        buscaList.appendChild(opt);
    });
}
atualizarDatalistBuscaLateral();
// Seleciona área ao escolher na busca lateral
document.getElementById('areaBuscaSelect').addEventListener('change', function () {
    const val = this.value;
    const area = getAllAreasWithAndar().find(a => `${a.nome} [${a.andarNome}]` === val);
    if (!area) return;
    if (currentAndarIdx !== area.andar) {
        andarSelect.value = area.andar;
        desenharAndar(area.andar);
    }
    setTimeout(() => {
        const idx = andares[area.andar].areas.findIndex(a2 => a2.nome === area.nome);
        if (idx >= 0 && areaObjs[idx]) {
            areaObjs[idx].fire('click');
            map.setView(area.label, Math.max(map.getZoom(), 1), { animate: true });
        }
    }, 300);
});

// Função para buscar área pelo nome+andar
function findAreaByInput(inputValue) {
    const allAreas = getAllAreasWithAndar();
    // inputValue: 'Sala A [1º Andar]'
    return allAreas.find(a => `${a.nome} [${a.andarNome}]` === inputValue);
}

// Função para buscar escada/elevador mais próxima
function findNearestTransferArea(andarIdx, fromLabel) {
    const areas = andares[andarIdx].areas;
    // Considera tipo 'escada' ou 'elevador' (pode ajustar conforme seu modelo)
    const transferAreas = areas.filter(a => a.tipo === 'escada' || a.tipo === 'elevador');
    if (transferAreas.length === 0) return null;
    let min = Infinity, nearest = null;
    transferAreas.forEach(a => {
        const d = dist(fromLabel, a.label);
        if (d < min) { min = d; nearest = a; }
    });
    return nearest;
}
// Define os bounds do PNG (ajuste conforme o tamanho da sua imagem)
const bounds = [[0, 0], [1000, 1000]];

// Adiciona o PNG como overlay
// L.imageOverlay('mapa.png', bounds).addTo(map);

// Ajusta o mapa para mostrar toda a imagem
map.fitBounds(bounds);

// Carrega opções de andares
function carregarAndares() {
    andarSelect.innerHTML = '';
    andares.forEach((andar, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = andar.nome;
        andarSelect.appendChild(opt);
    });
}

// Carrega opções de categorias únicas
function carregarCategorias() {
    const categorias = new Set();
    andares.forEach(andar => {
        andar.areas.forEach(area => {
            if (area.categoria) categorias.add(area.categoria);
        });
    });
    categoriaSelect.innerHTML = '<option value="">Filtrar por categoria</option>';
    categorias.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        categoriaSelect.appendChild(opt);
    });
}

// Chama ao iniciar
carregarAndares();
carregarCategorias();

categoriaSelect.onchange = function () {
    // Remove marcadores antigos
    categoriaMarkers.forEach(m => map.removeLayer(m));
    categoriaMarkers = [];
    const cat = categoriaSelect.value;
    // Destaca áreas da categoria
    let bounds = [];
    areaObjs.forEach((areaObj, idx) => {
        const areaData = andares[currentAndarIdx].areas[idx];
        const label = areaData.label;
        const labelValido = Array.isArray(label) && label.length === 2 &&
            typeof label[0] === 'number' && typeof label[1] === 'number' &&
            !isNaN(label[0]) && !isNaN(label[1]);
        if (cat && areaData.categoria === cat && labelValido) {
            areaObj.setStyle({ color: 'red', weight: 4 });
            bounds.push(label);
        } else {
            areaObj.setStyle({ color: 'transparent', weight: 3 });
        }
    });
    console.log('Labels válidos para centralizar:', bounds);
    if (bounds.length === 1) {
        map.setView(bounds[0], map.getZoom(), { animate: true });
    } else if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [40, 40] });
    }
    if (!cat) return;
    andares[currentAndarIdx].areas.forEach((area, idx) => {
        const label = area.label;
        const labelValido = Array.isArray(label) && label.length === 2 &&
            typeof label[0] === 'number' && typeof label[1] === 'number' &&
            !isNaN(label[0]) && !isNaN(label[1]);
        if (area.categoria === cat && labelValido) {
            const marker = L.marker(label, {
                title: area.nome + (area.subcategoria ? ' - ' + area.subcategoria : '')
            }).addTo(map);
            categoriaMarkers.push(marker);
        }
    });
};
