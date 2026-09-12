import * as THREE from 'three';
import Application from '../Application';
import { CameraKey } from '../Camera/Camera';
import './diskettes.css';

const LABELS = ['Über mich', 'Informatik', 'Jugendarbeit', 'Projekte', 'Kontakt'];
type Disk = {
    object: THREE.Object3D;
    home: THREE.Vector3;
    rotation: THREE.Quaternion;
    inBox: boolean;
    hitArea: THREE.Mesh;
};
type Motion = { duration: number; apply: (t: number) => void; finish?: () => void };
type HoverBounds = { left: number; right: number; top: number; bottom: number };
const ease = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** Visual disk handling only. Portfolio content routing can subscribe later. */
export default class DisketteBox {
    application = new Application();
    model: THREE.Group;
    box: THREE.Object3D;
    disks: Disk[] = [];
    latch: THREE.Object3D;
    driveHit: THREE.Mesh;
    led: THREE.Mesh;
    raycaster = new THREE.Raycaster();
    pointer = new THREE.Vector2();
    focused = false;
    busy = false;
    ready = false;
    inserted: number | null = null;
    hovered: number | null = null;
    fan = 0;
    private motions: Motion[] = [];
    private elapsed = 0;
    private signal = new AbortController();
    private status = document.createElement('p');
    private entryBounds: HoverBounds | null = null;
    private leaveRequested = false;
    private outsideTime = 0;
    private hoverSuppressed = false;
    private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    constructor() {
        const app = this.application;
        this.model = app.resources.items.gltfModel.disketteBoxModel.scene;
        this.model.scale.setScalar(900);
        app.scene.add(this.model);
        this.box = this.model.getObjectByName('StorageBox')!;
        this.model.updateMatrixWorld(true);
        const anisotropy = app.renderer.instance.capabilities.getMaxAnisotropy();
        this.model.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            for (const material of materials as THREE.MeshStandardMaterial[]) {
                if (material.map) material.map.anisotropy = anisotropy;
                if (material.transparent) material.depthWrite = false;
            }
        });
        LABELS.forEach((_, index) => {
            const object = this.model.getObjectByName(`Disk_${index}`)!;
            this.model.attach(object);
            object.traverse((part) => { part.userData.disketteIndex = index; });
            // Solid invisible jacket: hub/read-window holes remain visual, not holes in the hit target.
            const hitArea = new THREE.Mesh(new THREE.BoxGeometry(.6, .6, .016),
                new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
            hitArea.position.y = .3;
            hitArea.name = `Disk_${index}_interaction`;
            hitArea.userData.disketteIndex = index;
            object.add(hitArea);
            this.disks.push({ object, home: object.position.clone(), rotation: object.quaternion.clone(), inBox: true, hitArea });
        });
        // Existing baked room/computer materials are unlit; these lights shade the new moving props.
        const ambient = new THREE.HemisphereLight(0xe9edf0, 0x5b5142, 0.62);
        const key = new THREE.DirectionalLight(0xffedda, 1.25);
        key.position.set(-2500, 5500, 4000);
        const fill = new THREE.DirectionalLight(0xcbdce8, 0.45);
        fill.position.set(4000, 2600, -1400);
        app.scene.add(ambient, key, fill);
        this.latch = app.world.computerSetup.model.getObjectByName('DriveLatch')!;
        this.latch.rotation.z = Math.PI / 2;
        this.driveHit = new THREE.Mesh(new THREE.BoxGeometry(620, 155, 35), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
        this.driveHit.position.set(-.735 * 900, -.15 * 900, .977 * 900);
        this.driveHit.name = 'Diskette drive interaction';
        app.scene.add(this.driveHit);
        this.led = new THREE.Mesh(new THREE.PlaneGeometry(36, 13), new THREE.MeshBasicMaterial({ color: 0xff2916, transparent: true, opacity: 0, depthWrite: false }));
        this.led.position.set(-1.024 * 900, -.085 * 900, .967 * 900);
        app.scene.add(this.led);
        this.status.className = 'diskette-announcement';
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');
        document.body.appendChild(this.status);
        const options = { capture: true, signal: this.signal.signal };
        window.addEventListener('pointermove', this.onPointerMove, options);
        window.addEventListener('pointerdown', this.onPointerDown, options);
        window.addEventListener('mousedown', this.onMouseDown, options);
        window.addEventListener('keydown', this.onKeyDown, options);
        // Monitor iframe events arrive as mousemove, not pointermove.
        document.addEventListener('mousemove', (event) => {
            if ((event as MouseEvent & { inComputer?: boolean }).inComputer) this.requestLeave();
        }, options);
        document.addEventListener('pointerout', (event) => {
            if (!event.relatedTarget) this.requestLeave();
        }, options);
        window.addEventListener('blur', () => this.requestLeave(), { signal: this.signal.signal });
        document.addEventListener('loadingScreenDone', () => {
            this.ready = true;
        }, { signal: this.signal.signal });
        document.addEventListener('freeCamToggle', (event) => {
            if (this.busy) { event.stopImmediatePropagation(); return; }
            this.leaveFocus();
        }, { capture: true, signal: this.signal.signal });
    }

    focus() {
        if (!this.ready || this.focused || this.application.camera.freeCam) return;
        this.focused = true;
        this.leaveRequested = false;
        this.outsideTime = 0;
        document.body.classList.add('diskette-focused');
        this.status.textContent = 'Disketten auswählen. Tasten 1 bis 5: einlegen. E: auswerfen. Escape: zurück.';
        this.application.camera.interactionLocked = true;
        this.application.camera.transition(CameraKey.DISKETTES, this.reducedMotion.matches ? 150 : 1000);
    }

    close() {
        if (!this.focused || this.busy) return;
        this.leaveFocus();
        this.application.camera.transition(CameraKey.DESK, this.reducedMotion.matches ? 150 : 850);
    }

    private leaveFocus() {
        this.focused = false;
        this.hovered = null;
        this.entryBounds = null;
        this.leaveRequested = false;
        this.outsideTime = 0;
        document.body.classList.remove('diskette-pointer', 'diskette-focused');
        this.application.camera.interactionLocked = false;
    }

    private hit(event: MouseEvent | PointerEvent): { index?: number; drive?: boolean } | null {
        if (!this.ready || this.application.camera.freeCam) return null;
        if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return null;
        const rect = this.application.renderer.instance.domElement.getBoundingClientRect();
        this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
        this.raycaster.setFromCamera(this.pointer, this.application.camera.instance);
        this.model.updateMatrixWorld(true);
        const targets = [this.box, ...this.disks.filter(d => d.inBox).map(d => d.hitArea)];
        if (this.inserted !== null) targets.push(this.driveHit);
        const intersections = this.raycaster.intersectObjects(targets, true);
        if (!intersections.length) return null;
        const object = intersections[0].object;
        return object === this.driveHit ? { drive: true } : { index: object.userData.disketteIndex };
    }

    private isUi(target: EventTarget | null) {
        return target instanceof Element && !!target.closest('.interface-wrapper, #ui');
    }

    /** An envelope spans the gaps. The entry area bridges the camera's movement beneath a still cursor. */
    private focusBounds(): HoverBounds {
        this.model.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(this.box);
        for (const disk of this.disks) if (disk.inBox) bounds.expandByObject(disk.hitArea);
        const camera = this.application.camera.instance;
        const rect = this.application.renderer.instance.domElement.getBoundingClientRect();
        const projected: HoverBounds = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
        for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
            const point = new THREE.Vector3(x, y, z).project(camera);
            const px = rect.left + (point.x + 1) * rect.width / 2;
            const py = rect.top + (1 - point.y) * rect.height / 2;
            projected.left = Math.min(projected.left, px); projected.right = Math.max(projected.right, px);
            projected.top = Math.min(projected.top, py); projected.bottom = Math.max(projected.bottom, py);
        }
        return projected;
    }

    private insideBounds(event: PointerEvent, bounds: HoverBounds | null) {
        return !!bounds && event.clientX >= bounds.left - 18 && event.clientX <= bounds.right + 18 &&
            event.clientY >= bounds.top - 18 && event.clientY <= bounds.bottom + 18;
    }

    private requestLeave() {
        this.hovered = null;
        if (!this.leaveRequested) this.outsideTime = 0;
        this.leaveRequested = true;
        document.body.classList.remove('diskette-pointer');
    }

    private onPointerMove = (event: PointerEvent) => {
        if (event.pointerType === 'touch') return;
        if (this.isUi(event.target)) { this.requestLeave(); return; }
        const hit = this.hit(event);
        const overBox = !!hit && !hit.drive;
        if (!overBox && !this.focused) this.hoverSuppressed = false;
        if (overBox && !this.focused && !this.hoverSuppressed) {
            this.entryBounds = this.focusBounds();
            this.focus();
        }
        if (this.focused) {
            const inside = this.insideBounds(event, this.focusBounds());
            if (inside && this.application.camera.currentKeyframe === CameraKey.DISKETTES) this.entryBounds = null;
            if (inside || this.insideBounds(event, this.entryBounds)) {
                this.leaveRequested = false;
                this.outsideTime = 0;
            } else this.requestLeave();
        }
        this.hovered = !this.busy && this.focused ? (hit?.index ?? null) : null;
        document.body.classList.toggle('diskette-pointer', !!hit && !this.busy);
    };

    private onPointerDown = (event: PointerEvent) => {
        if (event.button !== 0 || this.isUi(event.target)) return;
        const hit = this.hit(event);
        if (!hit) {
            if (event.pointerType === 'touch' && this.focused) {
                event.preventDefault(); event.stopImmediatePropagation(); this.requestLeave();
            }
            return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        if (this.busy) return;
        if (hit.drive) { this.choose(null); this.requestLeave(); }
        else if (!this.focused) this.focus();
        else if (hit.index !== undefined) this.choose(hit.index);
    };

    private onMouseDown = (event: MouseEvent) => {
        if (this.busy && event.target instanceof Element && event.target.closest('[data-free-camera]')) {
            event.preventDefault(); event.stopImmediatePropagation(); return;
        }
        if (this.isUi(event.target)) return;
        if (this.focused || this.hit(event)) event.stopImmediatePropagation();
    };

    private onKeyDown = (event: KeyboardEvent) => {
        if (!this.focused) return;
        if (event.key === 'Escape') {
            event.preventDefault(); this.hoverSuppressed = true; this.requestLeave();
            if (!this.busy) this.close();
        } else if (/^[1-5]$/.test(event.key)) {
            event.preventDefault(); this.choose(Number(event.key) - 1);
        } else if (event.key?.toLowerCase() === 'e' && this.inserted !== null) {
            event.preventDefault(); this.choose(null);
        }
    };

    private boxPose(index: number) {
        const pose = this.disks[index].home.clone();
        pose.y += this.fan * index * .095;
        return pose;
    }

    /** Serialize a complete exchange. A disk always returns to its own original slot. */
    choose(index: number | null) {
        if (this.busy || !this.ready || this.application.camera.freeCam) return;
        if (index !== null && (!Number.isInteger(index) || index < 0 || index >= this.disks.length)) return;
        this.focus();
        if (index === this.inserted) index = null;
        if (index === null && this.inserted === null) return;
        this.busy = true;
        this.hovered = null;
        this.elapsed = 0;
        const previous = this.inserted;
        this.status.textContent = previous !== null ? `${LABELS[previous]} wird zurückgelegt …` : `${LABELS[index!]} wird eingelegt …`;
        const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, Math.PI));
        // Bottom edge leads into the slot; the paper label remains at the trailing edge.
        const entry = new THREE.Vector3(-.735, -.116, .98);
        const inside = new THREE.Vector3(-.735, -.116, .325);
        const lift = new THREE.Vector3(1.36, .65, .66);
        if (previous !== null) {
            const disk = this.disks[previous];
            disk.object.visible = true;
            this.turnLatch(Math.PI / 2);
            this.move(disk, entry, flat, 700, 0, () => this.clack('slide'));
            this.move(disk, lift, disk.rotation, 1050, .28);
            this.move(disk, this.boxPose(previous), disk.rotation, 700, .12, () => {
                disk.inBox = true;
                this.inserted = null;
                this.clack('case');
                if (index !== null) this.status.textContent = `${LABELS[index]} wird eingelegt …`;
            });
        }
        if (index !== null) {
            const selected = index;
            const disk = this.disks[selected];
            this.motions.push({ duration: 100, apply: () => {}, finish: () => { disk.inBox = false; this.clack('case'); } });
            this.move(disk, lift, disk.rotation, 750, .12);
            this.move(disk, entry, flat, 1100, .24);
            this.move(disk, inside, flat, 850, 0, () => this.clack('slide'));
            this.turnLatch(0);
            this.motions.push({ duration: 160, apply: () => {}, finish: () => {
                this.inserted = selected;
                disk.object.visible = false;
                this.motor();
            } });
        }
        this.motions.push({ duration: 120, apply: () => {}, finish: () => {
            this.busy = false;
            this.status.textContent = this.inserted === null ? 'Eine Diskette auswählen' : `${LABELS[this.inserted]} liegt im Laufwerk`;
        } });
    }

    private move(disk: Disk, end: THREE.Vector3, rotation: THREE.Quaternion, duration: number, arc = 0, finish?: () => void) {
        let start: THREE.Vector3 | undefined;
        let from: THREE.Quaternion;
        this.motions.push({ duration, apply: (t) => {
            if (!start) { start = disk.object.position.clone(); from = disk.object.quaternion.clone(); }
            disk.object.position.lerpVectors(start, end, ease(t));
            disk.object.position.y += Math.sin(Math.PI * t) * arc;
            disk.object.quaternion.slerpQuaternions(from, rotation, ease(t));
        }, finish });
    }

    private turnLatch(end: number) {
        let start: number | undefined;
        this.motions.push({ duration: 260, apply: (t) => {
            if (start === undefined) start = this.latch.rotation.z;
            this.latch.rotation.z = THREE.MathUtils.lerp(start, end, ease(t));
        }, finish: () => this.clack('latch') });
    }

    private clack(kind: 'case' | 'slide' | 'latch') {
        const audio = this.application.world.audioManager;
        audio.playAudio(kind === 'slide' ? 'keyboardKeydown' : 'mouseDown', {
            volume: kind === 'latch' ? .16 : .075, randDetuneScale: .3,
            filter: { type: 'lowpass', frequency: kind === 'latch' ? 2400 : 1100 },
        });
    }

    private motor() {
        // Route through the existing listener so the site's mute control also mutes this sound.
        const listener = this.application.world.audioManager.listener;
        const context = listener.context;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const filter = context.createBiquadFilter();
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(92, context.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(63, context.currentTime + .65);
        filter.type = 'lowpass'; filter.frequency.value = 420;
        gain.gain.setValueAtTime(0, context.currentTime);
        gain.gain.linearRampToValueAtTime(.026, context.currentTime + .06);
        gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .7);
        oscillator.connect(filter); filter.connect(gain); gain.connect(listener.getInput());
        oscillator.start(); oscillator.stop(context.currentTime + .72);
        oscillator.onended = () => { oscillator.disconnect(); filter.disconnect(); gain.disconnect(); };
    }

    update() {
        const dt = Math.min(this.application.time.delta, 80);
        if (this.focused && this.leaveRequested) {
            this.outsideTime += dt;
            if (!this.busy && this.outsideTime >= 220) this.close();
        }
        const blend = 1 - Math.exp(-dt / (this.reducedMotion.matches ? 35 : 160));
        this.fan = THREE.MathUtils.lerp(this.fan, this.focused ? 1 : 0, blend);
        if (!this.busy) {
            this.disks.forEach((disk, index) => {
                if (!disk.inBox) return;
                const target = this.boxPose(index);
                if (this.hovered === index) target.y += .19;
                disk.object.position.lerp(target, blend);
                const rotation = disk.rotation.clone();
                if (this.hovered === index) rotation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), .13));
                disk.object.quaternion.slerp(rotation, blend);
            });
        }
        if (this.motions.length) {
            const motion = this.motions[0];
            this.elapsed += dt;
            const duration = this.reducedMotion.matches ? Math.min(100, motion.duration) : motion.duration;
            const t = Math.min(1, this.elapsed / duration);
            motion.apply(t);
            if (t >= 1) { this.motions.shift(); this.elapsed = 0; motion.finish?.(); }
        }
        const material = this.led.material as THREE.MeshBasicMaterial;
        material.opacity = this.busy ? .32 + .52 * Math.max(0, Math.sin(performance.now() / 95)) : this.inserted !== null ? .12 : 0;
    }

    destroy() {
        this.signal.abort();
        this.status.remove();
        this.motions = [];
        document.body.classList.remove('diskette-pointer', 'diskette-focused');
        this.application.camera.interactionLocked = false;
    }
}
