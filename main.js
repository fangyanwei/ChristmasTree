/**
 * 3D 圣诞树主程序
 * 包含：场景搭建、后期处理、特效动画、交互逻辑
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import GUI from 'lil-gui';

// --- 场景初始化 ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050505); // 深色背景
scene.fog = new THREE.FogExp2(0x050505, 0.02); // 雾效

// 相机设置
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 8, 18); // 调整相机位置，稍微远一点

// 渲染器设置
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ReinhardToneMapping;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// 轨道控制器
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // 启用阻尼（惯性）
controls.autoRotate = false; // 初始步自动旋转（等待聚合动画完成）
controls.autoRotateSpeed = 0.5;
controls.target.set(0, 6, 0); // 【优化】将旋转中心设置在树的中心（树高12，中心约6）

// --- GUI 控制面板配置 ---
const gui = new GUI({ title: '🎄 圣诞树控制' });

// 默认参数
const defaults = {
    bloomStrength: 0.9,
    bloomRadius: 0.4,
    bloomThreshold: 0.2,
    focus: 15.0,
    aperture: 0.0001,
    maxblur: 0.01,
    rotateSpeed: 0.5,
    lightSpeed: 1.0,
    snowflakeSize: 0.25, // 雪花尺寸
    snowflakeCount: 1400, // 雪花数量
    fireworkRate: 0.015  // 烟花生成率
};

const params = { ...defaults };

// 重置功能
params.reset = function () {
    Object.assign(params, defaults);

    // 应用参数
    bloomPass.strength = params.bloomStrength;
    bloomPass.radius = params.bloomRadius;
    bloomPass.threshold = params.bloomThreshold;
    bokehPass.uniforms['focus'].value = params.focus;
    bokehPass.uniforms['aperture'].value = params.aperture;
    bokehPass.uniforms['maxblur'].value = params.maxblur;
    controls.autoRotateSpeed = params.rotateSpeed;

    // 更新 GUI 显示
    gui.folders.forEach(folder => {
        folder.controllers.forEach(controller => controller.updateDisplay());
    });
};

gui.add(params, 'reset').name('↺ 重置参数');

// 配置各分组
const folderBloom = gui.addFolder('✨ 辉光效果 (Bloom)');
folderBloom.add(params, 'bloomStrength', 0, 3).name('强度').onChange(v => bloomPass.strength = v);
folderBloom.add(params, 'bloomRadius', 0, 1).name('半径').onChange(v => bloomPass.radius = v);
folderBloom.add(params, 'bloomThreshold', 0, 1).name('阈值').onChange(v => bloomPass.threshold = v);

const folderBokeh = gui.addFolder('📷 相机景深 (Bokeh)');
folderBokeh.add(params, 'focus', 1, 100).name('焦距').onChange(v => bokehPass.uniforms['focus'].value = v);
folderBokeh.add(params, 'aperture', 0, 0.001).name('光圈').onChange(v => bokehPass.uniforms['aperture'].value = v);
folderBokeh.add(params, 'maxblur', 0, 0.05).name('最大模糊').onChange(v => bokehPass.uniforms['maxblur'].value = v);

const folderAnim = gui.addFolder('🔄 动画控制');
folderAnim.add(params, 'rotateSpeed', 0, 5).name('旋转速度').onChange(v => controls.autoRotateSpeed = v);
folderAnim.add(params, 'lightSpeed', 0, 5).name('灯光速度');

const folderEffects = gui.addFolder('✨ 特效调节');
folderEffects.add(params, 'snowflakeSize', 0.1, 1).name('雪花尺寸').onChange(v => {
    if (particlesMaterial) particlesMaterial.size = v;
});
folderEffects.add(params, 'snowflakeCount', 100, 3000, 100).name('雪花数量').onChange(v => {
    rebuildSnowflakes(Math.floor(v));
});
folderEffects.add(params, 'fireworkRate', 0, 0.1).name('烟花频率');

// --- 辅助函数：绘制高清雪花纹理 ---
function createSnowflakeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // 径向渐变背景
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(64, 64, 64, 0, Math.PI * 2);
    ctx.fill();

    // 绘制六角星纹理
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    ctx.translate(64, 64);
    for (let i = 0; i < 6; i++) {
        // 主干
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 50);
        ctx.stroke();

        // 分叉
        ctx.beginPath();
        ctx.moveTo(0, 30);
        ctx.lineTo(10, 40);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, 30);
        ctx.lineTo(-10, 40);
        ctx.stroke();

        ctx.rotate(Math.PI / 3);
    }

    return new THREE.CanvasTexture(canvas);
}

// --- Shader 逻辑：爆炸聚合动画 ---
const explosionUniforms = {
    uProgress: { value: 0.0 } // 0 = 爆炸状态, 1 = 聚合完成
};

// 【优化】加速变量：线性加快，让聚合越来越快
let explosionSpeed = 0.001; // 初始速度（减半）
const explosionAcceleration = 0.00025; // 每帧加速量（减半）

// 注入 Shader 代码
function injectExplosionShader(shader) {
    shader.uniforms.uProgress = explosionUniforms.uProgress;

    // 顶点着色器注入
    shader.vertexShader = `
        uniform float uProgress;
        attribute vec3 aRandomOffset;
    ` + shader.vertexShader;

    // 修改位置计算
    shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        
        float progress = smoothstep(0.0, 1.0, uProgress);
        float explodeFactor = 1.0 - pow(progress, 0.5); // 缓动函数
        
        // 核心逻辑：原始位置 + 随机偏移 * 爆炸因子
        transformed += aRandomOffset * explodeFactor * 20.0;
        `
    );
}

// 辅助函数：根据数量生成随机偏移量
function addRandomOffsets(geometry, count) {
    const offsets = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1); // 球面均匀分布

        offsets[i * 3] = Math.sin(phi) * Math.cos(theta); // x
        offsets[i * 3 + 1] = Math.sin(phi) * Math.sin(theta); // y
        offsets[i * 3 + 2] = Math.cos(phi); // z
    }
    geometry.setAttribute('aRandomOffset', new THREE.InstancedBufferAttribute(offsets, 3));
}

// --- 辅助函数：创建五角星几何体 ---
function createStarGeometry(outerRadius, innerRadius, thickness) {
    const shape = new THREE.Shape();
    const PI2 = Math.PI * 2;
    // 绘制五角星轮廓
    for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const a = (i / 10) * PI2;
        // 旋转 -PI/2 使其顶点朝上
        const x = Math.cos(a - Math.PI / 2) * radius;
        const y = Math.sin(a - Math.PI / 2) * radius;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
    }
    // 挤压成 3D
    const extrudeSettings = {
        steps: 1,
        depth: thickness,
        bevelEnabled: true,
        bevelThickness: 0.1,
        bevelSize: 0.1,
        bevelSegments: 2
    };
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
}

// --- 树体构建 (InstancedMesh) ---
const treeHeight = 12;
const treeRadius = 4;
const leafCount = 3000;

// 使用四面体模拟针叶
const leafGeometry = new THREE.TetrahedronGeometry(0.15, 0);
addRandomOffsets(leafGeometry, leafCount);

// 【优化】树叶材质：更亮的绿色
const leafMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a5c2a, // 【优化】更鲜亮的绿色
    roughness: 0.7,
    metalness: 0.1,
    emissive: 0x0a2a10, // 微弱的绿色自发光
    emissiveIntensity: 0.4
});
leafMaterial.onBeforeCompile = injectExplosionShader;

const treeMesh = new THREE.InstancedMesh(leafGeometry, leafMaterial, leafCount);
const dummy = new THREE.Object3D();

// 螺旋分布算法生成树体
for (let i = 0; i < leafCount; i++) {
    const ratio = i / leafCount;
    const h = ratio * treeHeight;
    const r = (1 - ratio) * treeRadius; // 越往上越细

    // 螺旋角度 + 随机扰动
    const angle = ratio * Math.PI * 40 + Math.random() * 0.5;
    const dist = r * (0.5 + Math.random() * 0.5); // 分布在内部到表面之间

    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const y = h;

    dummy.position.set(x, y, z);
    dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    dummy.scale.setScalar(0.5 + Math.random() * 1.5);
    dummy.updateMatrix();
    treeMesh.setMatrixAt(i, dummy.matrix);
}
scene.add(treeMesh);

// --- 装饰物：球体 (InstancedMesh) ---
const ornamentCount = 400;
const ornamentGeometry = new THREE.SphereGeometry(0.15, 16, 16);
addRandomOffsets(ornamentGeometry, ornamentCount);

const ornamentMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.3,
    metalness: 0.4,
    emissive: 0x555555 // 【优化】提高自发光亮度
});
ornamentMaterial.onBeforeCompile = injectExplosionShader;

const ornaments = new THREE.InstancedMesh(ornamentGeometry, ornamentMaterial, ornamentCount);
const colors = [];
const colorPalette = [
    new THREE.Color(0xcc2222), // 【优化】纯正红
    new THREE.Color(0xd4af37), // 【优化】金色
    new THREE.Color(0x2266cc), // 【优化】深蓝
    new THREE.Color(0x22aa44), // 【优化】绿色
    new THREE.Color(0xeecc44)  // 【优化】明黄
];

const originalColors = new Float32Array(ornamentCount * 3);

for (let i = 0; i < ornamentCount; i++) {
    const ratio = Math.random();
    const h = ratio * treeHeight;
    const r = (1 - ratio) * treeRadius;
    const angle = Math.random() * Math.PI * 2;
    // 分布在表面
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const y = h;

    dummy.position.set(x, y, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1 + Math.random());
    dummy.updateMatrix();
    ornaments.setMatrixAt(i, dummy.matrix);

    // 随机颜色
    const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
    colors.push(color.r, color.g, color.b);

    // 保存原始颜色用于交互还原
    originalColors[i * 3] = color.r;
    originalColors[i * 3 + 1] = color.g;
    originalColors[i * 3 + 2] = color.b;
}

ornaments.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(colors), 3);
scene.add(ornaments);

// --- 装饰物：方块/礼物 (InstancedMesh) ---
const boxCount = 200;
const boxGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
addRandomOffsets(boxGeometry, boxCount);

const boxMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.3,
    metalness: 0.4,
    emissive: 0x555555 // 【优化】提高自发光亮度
});
boxMaterial.onBeforeCompile = injectExplosionShader;

const boxes = new THREE.InstancedMesh(boxGeometry, boxMaterial, boxCount);
const boxColors = [];

for (let i = 0; i < boxCount; i++) {
    const ratio = Math.random();
    const h = ratio * treeHeight;
    const r = (1 - ratio) * treeRadius;
    const angle = Math.random() * Math.PI * 2;
    const x = Math.cos(angle) * (r + 0.2); // 稍微突出一点
    const z = Math.sin(angle) * (r + 0.2);
    const y = h;

    dummy.position.set(x, y, z);
    dummy.rotation.set(Math.random(), Math.random(), Math.random());
    dummy.scale.setScalar(0.8 + Math.random());
    dummy.updateMatrix();
    boxes.setMatrixAt(i, dummy.matrix);

    const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
    boxColors.push(color.r, color.g, color.b);
}
boxes.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(boxColors), 3);
scene.add(boxes);

// --- 顶部星星 ---
// 【优化】替换为五角星模型
const starGeometry = createStarGeometry(0.8, 0.4, 0.3);
const starMaterial = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    emissive: 0xffd700,
    emissiveIntensity: 0.8,
    roughness: 0.1,
    metalness: 0.8
});
const star = new THREE.Mesh(starGeometry, starMaterial);

// 【优化】星星也从随机位置聚合过来
const starFinalPosition = new THREE.Vector3(0, treeHeight + 0.2, 0);
const starRandomOffset = new THREE.Vector3(
    (Math.random() - 0.5) * 30,
    (Math.random() - 0.5) * 30 + 15, // 偏上方
    (Math.random() - 0.5) * 30
);
star.position.copy(starFinalPosition).add(starRandomOffset); // 初始在随机位置
scene.add(star);

const starLight = new THREE.PointLight(0xffd700, 2, 20);
starLight.position.copy(star.position);
scene.add(starLight);

// --- 环境背景 ---
// 地面反射
const planeGeo = new THREE.PlaneGeometry(200, 200);
const planeMat = new THREE.MeshStandardMaterial({
    color: 0x050505,
    roughness: 0.8, // 【优化】粗糙度调高以消除强反光
    metalness: 0.2  // 【优化】金属度调低
});
const plane = new THREE.Mesh(planeGeo, planeMat);
plane.rotation.x = -Math.PI / 2;
scene.add(plane);

// 雪花粒子系统
let particlesGeometry = new THREE.BufferGeometry();
let particlesMesh;
const snowflakeTexture = createSnowflakeTexture();
const particlesMaterial = new THREE.PointsMaterial({
    size: params.snowflakeSize,
    map: snowflakeTexture,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthTest: false
});

// 重建雪花粒子系统函数
function rebuildSnowflakes(count) {
    if (particlesMesh) {
        scene.remove(particlesMesh);
        particlesGeometry.dispose();
    }
    particlesGeometry = new THREE.BufferGeometry();
    const posArray = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 50;
    }
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);
}

// 初始化雪花
rebuildSnowflakes(params.snowflakeCount);

// --- 烟花粒子系统 ---
const fireworks = [];
const fireworkColors = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 0xff44ff, 0x44ffff, 0xffffff, 0xff8844, 0x88ff44];

// 创建升空的火箭
function createRocket() {
    // 随机位置（在远处生成，模拟远景烟花）
    const minRadius = 18; // 【优化】更远的最小距离
    const maxRadius = 35; // 【优化】更远的最大距离
    const angle = Math.random() * Math.PI * 2;
    const radius = minRadius + Math.random() * (maxRadius - minRadius);
    const startX = Math.cos(angle) * radius;
    const startZ = Math.sin(angle) * radius;
    const startY = 0; // 从地面发射
    const targetY = 8 + Math.random() * 8; // 爆炸高度 8-16

    // 火箭粒子（单个发光点）
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([startX, startY, startZ]), 3));

    // 【优化】火箭颜色也随机
    const rocketColor = fireworkColors[Math.floor(Math.random() * fireworkColors.length)];
    const material = new THREE.PointsMaterial({
        size: 0.25, // 【优化】调大尺寸，远处也能看到
        color: rocketColor,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending
    });

    const rocket = new THREE.Points(geometry, material);
    scene.add(rocket);

    return {
        type: 'rocket',
        points: rocket,
        x: startX,
        y: startY,
        z: startZ,
        targetY: targetY,
        speed: 0.15 + Math.random() * 0.1 // 上升速度
    };
}

// 创建爆炸烟花（多色）
function createExplosion(x, y, z) {
    const particleCount = 100;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        // 随机方向速度（球形扩散）
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const speed = 0.08 + Math.random() * 0.12;
        velocities.push({
            x: Math.sin(phi) * Math.cos(theta) * speed,
            y: Math.sin(phi) * Math.sin(theta) * speed,
            z: Math.cos(phi) * speed
        });

        // 【优化】每个粒子随机颜色
        const color = new THREE.Color(fireworkColors[Math.floor(Math.random() * fireworkColors.length)]);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 0.2, // 【优化】调大尺寸，远处也能看到
        vertexColors: true,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthTest: false
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    return {
        type: 'explosion',
        points,
        velocities,
        life: 1.0,
        decay: 0.01 + Math.random() * 0.005
    };
}

// 更新烟花
function updateFireworks() {
    // 随机生成新火箭（使用 GUI 参数）
    if (Math.random() < params.fireworkRate && fireworks.length < 8) {
        fireworks.push(createRocket());
    }

    // 更新现有烟花/火箭
    for (let i = fireworks.length - 1; i >= 0; i--) {
        const fw = fireworks[i];

        if (fw.type === 'rocket') {
            // 火箭上升
            fw.y += fw.speed;
            const positions = fw.points.geometry.attributes.position.array;
            positions[1] = fw.y;
            fw.points.geometry.attributes.position.needsUpdate = true;

            // 到达目标高度，爆炸
            if (fw.y >= fw.targetY) {
                scene.remove(fw.points);
                fw.points.geometry.dispose();
                fw.points.material.dispose();
                fireworks.splice(i, 1);

                // 创建爆炸
                fireworks.push(createExplosion(fw.x, fw.y, fw.z));
            }
        } else if (fw.type === 'explosion') {
            // 爆炸扩散
            const positions = fw.points.geometry.attributes.position.array;

            for (let j = 0; j < fw.velocities.length; j++) {
                positions[j * 3] += fw.velocities[j].x;
                positions[j * 3 + 1] += fw.velocities[j].y - 0.003; // 重力
                positions[j * 3 + 2] += fw.velocities[j].z;

                fw.velocities[j].x *= 0.97;
                fw.velocities[j].y *= 0.97;
                fw.velocities[j].z *= 0.97;
            }
            fw.points.geometry.attributes.position.needsUpdate = true;

            // 透明度衰减
            fw.life -= fw.decay;
            fw.points.material.opacity = fw.life;

            // 移除死亡烟花
            if (fw.life <= 0) {
                scene.remove(fw.points);
                fw.points.geometry.dispose();
                fw.points.material.dispose();
                fireworks.splice(i, 1);
            }
        }
    }
}

// --- 灯光系统 ---
const ambientLight = new THREE.AmbientLight(0x808080, 4); // 【优化】进一步增强环境光
scene.add(ambientLight);

// 【优化】方向光跟随相机，保证始终从观察者角度照亮
const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
scene.add(dirLight);

// 动态旋转彩灯
const light1 = new THREE.PointLight(0xff0000, 5, 10);
const light2 = new THREE.PointLight(0x0000ff, 5, 10);
scene.add(light1, light2);

// --- 后期处理 ---
const renderScene = new RenderPass(scene, camera);

// Bloom 辉光
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0.4; // 【优化】提高阈值，只让最亮的部分发光
bloomPass.strength = 0.8;  // 【优化】降低强度
bloomPass.radius = 0.3;    // 【优化】缩小半径

// Bokeh 景深
const bokehPass = new BokehPass(scene, camera, {
    focus: 15.0,
    aperture: 0.0001,
    maxblur: 0.01,
    width: window.innerWidth,
    height: window.innerHeight
});

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);
composer.addPass(bokehPass);

// --- 交互逻辑 (Raycaster) ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredInstanceId = -1;
const whiteColor = new THREE.Color(0xffffff);

window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

// --- 动画循环 ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const time = clock.getElapsedTime();
    const delta = clock.getDelta();

    // 更新聚合动画进度 - 【优化】线性加速效果
    if (explosionUniforms.uProgress.value < 1) {
        explosionSpeed += explosionAcceleration; // 每帧加速
        explosionUniforms.uProgress.value += explosionSpeed;

        // 【优化】星星也跟随进度从随机位置飞向顶部
        const progress = explosionUniforms.uProgress.value;
        const easeProgress = 1 - Math.pow(1 - progress, 2); // 缓动函数
        star.position.lerpVectors(
            starFinalPosition.clone().add(starRandomOffset),
            starFinalPosition,
            easeProgress
        );
        starLight.position.copy(star.position);

        if (explosionUniforms.uProgress.value >= 1) {
            explosionUniforms.uProgress.value = 1;
            star.position.copy(starFinalPosition); // 确保最终位置准确
            controls.autoRotate = true; // 聚合完成后开始旋转
        }
    }

    controls.update();

    // 【优化】让方向光始终跟随相机位置，保证各角度亮度一致
    dirLight.position.copy(camera.position);

    // 交互检测
    raycaster.setFromCamera(mouse, camera);
    const intersection = raycaster.intersectObject(ornaments);

    if (intersection.length > 0) {
        const instanceId = intersection[0].instanceId;
        if (instanceId !== hoveredInstanceId) {
            // 恢复之前高亮的球体颜色
            if (hoveredInstanceId !== -1) {
                ornaments.setColorAt(hoveredInstanceId, new THREE.Color(
                    originalColors[hoveredInstanceId * 3],
                    originalColors[hoveredInstanceId * 3 + 1],
                    originalColors[hoveredInstanceId * 3 + 2]
                ));
            }
            // 高亮当前球体
            ornaments.setColorAt(instanceId, whiteColor);
            ornaments.instanceColor.needsUpdate = true;
            hoveredInstanceId = instanceId;
        }
    } else {
        // 鼠标移出，恢复颜色
        if (hoveredInstanceId !== -1) {
            ornaments.setColorAt(hoveredInstanceId, new THREE.Color(
                originalColors[hoveredInstanceId * 3],
                originalColors[hoveredInstanceId * 3 + 1],
                originalColors[hoveredInstanceId * 3 + 2]
            ));
            ornaments.instanceColor.needsUpdate = true;
            hoveredInstanceId = -1;
        }
    }

    // 更新物体动画
    // 星星旋转
    star.rotation.y = time * 0.5;
    star.rotation.z = Math.sin(time) * 0.1;

    // 星星光效呼吸
    starLight.intensity = 2 + Math.sin(time * 5);

    // 彩灯飞舞
    const speed = params.lightSpeed;
    light1.position.set(
        Math.cos(time * speed) * 6,
        Math.sin(time * 0.5 * speed) * 6 + 6,
        Math.sin(time * speed) * 6
    );
    light2.position.set(
        Math.sin(time * 0.8 * speed) * 6,
        Math.cos(time * 0.5 * speed) * 6 + 6,
        Math.cos(time * 0.8 * speed) * 6
    );

    // 雪花下落
    particlesMesh.rotation.y = time * 0.05;
    particlesMesh.position.y = -time % 10;

    // 更新烟花
    updateFireworks();

    // 渲染
    composer.render();
}

// 窗口尺寸自适应
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    bokehPass.setSize(window.innerWidth, window.innerHeight);
});

animate(); // 启动循环
