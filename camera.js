function degToRad(d) {
    return d * Math.PI / 180;
}

const points = {
    P0: [-30, 20, 15],
    P1: [-15, 15, 25],
    P2: [30, 30, 30],
    P3: [40, 60, 20],
    P4: [50, 75, 10],
    P5: [40, 60, -10],
    P6: [30, 45, -15],
    P7: [15, 30, -25],
    P8: [-5, 45, -30],
    P9: [-20, 60, -20],
    P10: [-35, 75, -10],
    P11: [-45, 60, 5],
    P12: [-30, 30, 15]
};

//Funções para vetores tridimensionais ////////////////////////////////
function calculatePoint(points, t) {
    if (t <= 0.25) {
        t *= 4;
        if (t==1) {
        t-= 0.001;
        }
        const startIndex = 0;
        const X = points[`P${startIndex}`];
        const Y = points[`P${startIndex + 1}`];
        const Z = points[`P${startIndex + 2}`];
        const W = points[`P${startIndex + 3}`];

        const A = X.map((coord, index) => coord + t * (Y[index] - coord));
        const B = Y.map((coord, index) => coord + t * (Z[index] - coord));
        const C = Z.map((coord, index) => coord + t * (W[index] - coord));

        const AB = A.map((coord, index) => coord + t * (B[index] - coord));
        const BC = B.map((coord, index) => coord + t * (C[index] - coord));

        const ABC = AB.map((coord, index) => coord + t * (BC[index] - coord));

        return ABC;
    } else if (t > 0.25 && t <= 0.5) {
        t -= 0.25;
        t *= 4;
        if (t==1) {
        t-= 0.001;
        }
        const startIndex = 3;
        const X = points[`P${startIndex}`];
        const Y = points[`P${startIndex + 1}`];
        const Z = points[`P${startIndex + 2}`];
        const W = points[`P${startIndex + 3}`];

        const A = X.map((coord, index) => coord + t * (Y[index] - coord));
        const B = Y.map((coord, index) => coord + t * (Z[index] - coord));
        const C = Z.map((coord, index) => coord + t * (W[index] - coord));

        const AB = A.map((coord, index) => coord + t * (B[index] - coord));
        const BC = B.map((coord, index) => coord + t * (C[index] - coord));

        const ABC = AB.map((coord, index) => coord + t * (BC[index] - coord));

        return ABC;
    } else if (t > 0.5 && t <= 0.75) {
        t -= 0.5;
        t *= 4;
        if (t==1) {
        t-= 0.001;
        }
        const startIndex = 6;
        const X = points[`P${startIndex}`];
        const Y = points[`P${startIndex + 1}`];
        const Z = points[`P${startIndex + 2}`];
        const W = points[`P${startIndex + 3}`];

        const A = X.map((coord, index) => coord + t * (Y[index] - coord));
        const B = Y.map((coord, index) => coord + t * (Z[index] - coord));
        const C = Z.map((coord, index) => coord + t * (W[index] - coord));

        const AB = A.map((coord, index) => coord + t * (B[index] - coord));
        const BC = B.map((coord, index) => coord + t * (C[index] - coord));

        const ABC = AB.map((coord, index) => coord + t * (BC[index] - coord));

        return ABC;
    } else {
        t -= 0.75;
        t *= 4;
        if (t==1) {
        t-= 0.001;
        }
        const startIndex = 9;
        const X = points[`P${startIndex}`];
        const Y = points[`P${startIndex + 1}`];
        const Z = points[`P${startIndex + 2}`];
        const W = points[`P${startIndex + 3}`];

        const A = X.map((coord, index) => coord + t * (Y[index] - coord));
        const B = Y.map((coord, index) => coord + t * (Z[index] - coord));
        const C = Z.map((coord, index) => coord + t * (W[index] - coord));

        const AB = A.map((coord, index) => coord + t * (B[index] - coord));
        const BC = B.map((coord, index) => coord + t * (C[index] - coord));

        const ABC = AB.map((coord, index) => coord + t * (BC[index] - coord));

        return ABC;
    }
}

function getCamera() {
    // Atualize a matriz de visualização da câmera antes de retorná-la
    camera = m4.lookAt(cameraPosition, target, up);
    view = m4.inverse(camera);
    
    return view; // Retorna a matriz de visualização da câmera
}


// Obtém o elemento HTML do canvas
var canvas = document.getElementById("canvas")

// Inicializa os ângulos de rotação da câmera
var cameraRotation = [0, 0]; // Initialize camera rotation angles
var isMouseOverCanvas = false;
var previousMouseX = 0;
var previousMouseY = 0;

// Obtém o retângulo que descreve a posição do canvas na janela
var canvasRect = canvas.getBoundingClientRect(); // Retornar o retângulo que descreve a posição do canvas na janela

// Define um evento de "mouseover" para quando o mouse entra no canvas
canvas.addEventListener("mouseover", function (event) {
    isMouseOverCanvas = true;
    previousMouseX = event.clientX;
    previousMouseY = event.clientY;
});

// Define um evento de "mousemove" para rastrear o movimento do mouse
canvas.addEventListener("mousemove", function (event) {
    if (isMouseOverCanvas) {
        var x = event.clientX - canvasRect.left; // Coordenada X relativa ao canvas
        var y = event.clientY - canvasRect.top;  // Coordenada Y relativa ao canvas

        // Verifique se o cursor está dentro dos limites do canvas
        if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
            var deltaX = x - previousMouseX;
            var deltaY = y - previousMouseY;

            previousMouseX = x;
            previousMouseY = y;

            // Atualiza a rotação da câmera com base no movimento do mouse
            cameraRotation[0] -= degToRad(deltaY * 0.5); // Pitch
            cameraRotation[1] -= degToRad(deltaX * 0.5); // Yaw

            // Limita o pitch para evitar que a câmera gire demais
            cameraRotation[0] = Math.max(-Math.PI / 3, Math.min(Math.PI / 2, cameraRotation[0]));

            // Calcula a nova posição do alvo com base na rotação da câmera e em uma distância fixa
            var distance = 100000;
            target[0] = cameraPosition[0] + Math.sin(cameraRotation[1]) * Math.cos(cameraRotation[0]) * distance;
            target[1] = cameraPosition[1] + Math.sin(cameraRotation[0]) * distance;
            target[2] = cameraPosition[2] + Math.cos(cameraRotation[1]) * Math.cos(cameraRotation[0]) * distance;
        }
    }
});

// Define um evento de "mouseout" para quando o mouse sai do canvas
canvas.addEventListener("mouseout", function () {
    isMouseOverCanvas = false;
});

canvas.addEventListener("mouseleave", function () {
    isMouseDragging = false;
});

// Configuração da câmera e da cena
// var bezierCurve = calculateEachCurve();
// var cameraPosition = bezierCurve.currentArray;
var fov = degToRad(60);

var cameraPosition = [0, 80, 120]; // Posição inicial da câmera
var target = [0, 100, 0]; // Posição do alvo da câmera
var up = [0, 1, 0]; // Vetor "up" da câmera
var camera = m4.lookAt(cameraPosition, target, up); // Matriz de visualização da câmera
var view = m4.inverse(camera); // Matriz de visão inversa da câmera
var animationDuration = 50000; // Duração da animação em milissegundos
var cameraSpeed = 0.00005; // Velocidade com que a câmera se move ao longo do eixo Z

// Registra o horário de início da animação
var startTime = Date.now();

// Calcula a posição da câmera com base no tempo e nos pontos de controle
var cameraPosition = calculatePoint(points, 0);
var t = 0

// Função para animar a câmera
function animateCamera() {
    var currentTime = Date.now();
    var animationDuration = 60000;
    var t = (currentTime % animationDuration) / animationDuration;

    // Calculate camera position based on time
    cameraPosition = calculatePoint(points, t);

    camera = m4.lookAt(cameraPosition, target, up);
    view = m4.inverse(camera);

    requestAnimationFrame(animateCamera);
}

// Inicia a animação da câmera
animateCamera();