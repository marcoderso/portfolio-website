// Deterministic animation/state tests using real Three.js transforms and exported GLB node hierarchies.
// No browser, GPU, downloaded test runner, or additional dependencies required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const THREE = require('three');
const root = path.resolve(__dirname, '..');

class ElementStub {
    constructor() {
        this.attributes = new Map(); this.dataset = {}; this.children = [];
        this.style = { setProperty() {} };
        this.classList = { add() {}, remove() {}, toggle() {} };
    }
    setAttribute(name, value) { this.attributes.set(name, value); }
    append(...children) { this.children.push(...children); }
    appendChild(child) { this.append(child); }
    addEventListener() {}
    focus() {}
    remove() {}
    closest() { return null; }
}

function loadHierarchy(relative) {
    const buffer = fs.readFileSync(path.join(root, relative));
    assert.equal(buffer.readUInt32LE(0), 0x46546c67);
    const gltf = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString());
    assert(!gltf.nodes.some(node => /receiver/i.test(node.name)), 'No bake receiver may leak into the web export');
    const objects = gltf.nodes.map(node => {
        const object = new THREE.Object3D(); object.name = node.name || '';
        if (node.translation) object.position.fromArray(node.translation);
        if (node.rotation) object.quaternion.fromArray(node.rotation);
        if (node.scale) object.scale.fromArray(node.scale);
        if (node.matrix) new THREE.Matrix4().fromArray(node.matrix).decompose(object.position, object.quaternion, object.scale);
        return object;
    });
    gltf.nodes.forEach((node, i) => node.children?.forEach(j => objects[i].add(objects[j])));
    const group = new THREE.Group();
    gltf.scenes[gltf.scene || 0].nodes.forEach(i => group.add(objects[i]));
    return group;
}

function fixture(reducedMotion, delta) {
    const instance = new THREE.PerspectiveCamera(35, 1.4, 100, 200000);
    instance.position.set(2600, 3200, 6400); instance.lookAt(500, 150, 0); instance.updateMatrixWorld(true);
    const camera = { instance, currentKeyframe: 'desk', interactionLocked: false, freeCam: false,
        transition(key) { this.key = key; this.currentKeyframe = key; } };
    const app = {
        scene: new THREE.Scene(), camera, time: { delta },
        renderer: { instance: { capabilities: { getMaxAnisotropy: () => 8 },
            domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1400, height: 1000 }) } } },
        resources: { items: { gltfModel: { disketteBoxModel: { scene: loadHierarchy('static/models/Diskettes/diskette_box.glb') } } } },
        world: { computerSetup: { model: loadHierarchy('static/models/Computer/computer_setup_interactive.glb') }, audioManager: { playAudio() {} } },
    };
    const exports = {};
    const source = ts.transpileModule(fs.readFileSync(path.join(root, 'src/Application/World/DisketteBox.ts'), 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    }).outputText;
    vm.runInNewContext(source, {
        exports, AbortController, performance, Element: ElementStub,
        document: { createElement: () => new ElementStub(), createTextNode: text => text, body: new ElementStub(), addEventListener() {} },
        window: { matchMedia: () => ({ matches: reducedMotion }), addEventListener() {} },
        require(name) {
            if (name === 'three') return THREE;
            if (name === '../Application') return { default: function Application() { return app; } };
            if (name === '../Camera/Camera') return { CameraKey: { DISKETTES: 'diskettes', DESK: 'desk' } };
            if (name === '../UI/EventBus') return { default: { on() {} } };
            if (name.endsWith('.css')) return {};
            throw new Error(`Unexpected import: ${name}`);
        },
    });
    const box = new exports.default(); box.ready = true; box.motor = () => {};
    const settle = () => {
        for (let frames = 0; box.busy; frames++) {
            assert(frames < 2000, 'Animation must terminate'); box.update();
            assert(box.disks.filter(disk => !disk.inBox).length <= 1, 'Only one disk may be out of the box');
        }
        for (let i = 0; i < 180; i++) box.update();
    };
    const pointer = (x, y) => ({ clientX: x, clientY: y, pointerType: 'mouse', button: 0,
        target: new ElementStub(), preventDefault() {}, stopImmediatePropagation() {} });
    const atDisk = (index, height = .283) => {
        app.scene.updateMatrixWorld(true);
        const p = box.disks[index].object.localToWorld(new THREE.Vector3(0, height, .009)).project(instance);
        return pointer((p.x + 1) * 700, (1 - p.y) * 500);
    };
    return { box, camera, settle, pointer, atDisk };
}

for (const reduced of [false, true]) {
    const { box, camera, settle, pointer, atDisk } = fixture(reduced, 16);
    const hole = atDisk(0);
    assert.equal(box.hit(hole).index, 0, 'A ray through the front hub must not select a rear disk');
    box.onPointerMove(hole);
    assert.equal(box.focused, true, 'Hover must focus without a click');
    assert.equal(camera.key, 'diskettes');
    settle();
    const focusedHole = atDisk(0);
    assert.equal(box.hit(focusedHole).index, 0);
    box.onPointerDown(focusedHole); settle();
    assert.equal(box.inserted, 0, 'Clicking the front hole loads the front disk');
    box.onPointerMove(pointer(10, 980));
    for (let i = 0; i < 5; i++) box.update();
    assert.equal(box.focused, true, 'Small exit grace avoids hover flicker');
    settle();
    assert.equal(box.focused, false); assert.equal(camera.key, 'desk', 'Exit returns to seated view, never monitor or room');
    box.onPointerMove(atDisk(1)); settle();
    assert.equal(box.focused, true);
    const envelope = box.focusBounds();
    box.onPointerMove(pointer(envelope.right + 10, (envelope.top + envelope.bottom) / 2));
    settle(); assert.equal(box.focused, true, 'Small gaps/edge tolerance retain focus');
    box.choose(2); box.onPointerMove(pointer(10, 980));
    assert.equal(box.focused, true); assert.equal(box.busy, true);
    settle(); assert.equal(box.inserted, 2); assert.equal(box.focused, false);
    assert.equal(camera.key, 'desk', 'Deferred exit completes after the disk exchange');
    box.onPointerMove(atDisk(1)); settle();
    box.onKeyDown({ key: 'Escape', preventDefault() {} });
    assert.equal(box.focused, false);
    box.onPointerMove(atDisk(1)); assert.equal(box.focused, false, 'Escape must not immediately refocus');
    box.onPointerMove(pointer(10, 980)); box.onPointerMove(atDisk(1));
    assert.equal(box.focused, true);
    box.destroy();
    console.log(`PASS hover/no-click/solid-hub/exit-grace/deferred-exit/Escape; reduced=${reduced}`);
}

for (const reduced of [false, true]) {
    for (const delta of [16, 33, 80]) {
        const { box, camera, settle } = fixture(reduced, delta);
        box.choose(-1); box.choose(8); box.choose(1.5);
        assert.equal(box.busy, false);
        box.focus(); settle(); assert.equal(camera.interactionLocked, true);
        for (const index of [0, 2, 4, 1, 3]) {
            box.choose(index);
            assert.equal(box.busy, true);
            box.choose((index + 1) % 5); // Repeated clicks must not enqueue another exchange.
            box.close(); assert.equal(box.focused, true, 'Cannot leave halfway through an exchange');
            settle();
            assert.equal(box.inserted, index);
            assert.equal(box.latch.rotation.z, 0);
            box.disks.forEach((disk, i) => {
                assert.equal(disk.inBox, i !== index);
                assert.equal(disk.object.visible, i !== index);
                if (disk.inBox) assert(disk.object.position.distanceTo(box.boxPose(i)) < .0001);
            });
        }
        box.choose(3); settle(); // Choosing the loaded disk again ejects it.
        assert.equal(box.inserted, null); assert(box.disks.every(d => d.inBox && d.object.visible));
        box.choose(1); settle(); box.choose(null); settle();
        assert.equal(box.inserted, null); assert.equal(box.latch.rotation.z, Math.PI / 2);
        box.close(); settle(); assert.equal(camera.interactionLocked, false); assert.equal(camera.key, 'desk');
        box.disks.forEach(d => assert(d.object.position.distanceTo(d.home) < .0001, 'Return to exact storage position'));
        box.destroy();
        console.log(`PASS exchange/eject/repeated-click/close/home; reduced=${reduced}, delta=${delta}ms`);
    }
}
