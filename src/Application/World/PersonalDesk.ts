import * as THREE from 'three';
import Application from '../Application';

/** Quiet, non-interactive desk props. No hit targets or portfolio navigation. */
export default class PersonalDesk {
    private application = new Application();
    private model: THREE.Group;
    private smoke: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
    private ember?: THREE.MeshStandardMaterial;
    private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    private elapsed = 0;

    constructor() {
        const app = this.application;
        this.model = app.resources.items.gltfModel.personalDeskModel.scene;
        this.model.scale.setScalar(900);
        app.scene.add(this.model);
        // Complex amber refraction is baked in Cycles onto the real 3D bowl.
        // An unlit web material avoids relighting / washing out the bake.
        const anisotropy = app.renderer.instance.capabilities.getMaxAnisotropy();
        this.model.traverse(object => {
            if (!(object instanceof THREE.Mesh)) return;
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            for (const material of materials as THREE.MeshStandardMaterial[]) {
                if (material.map) material.map.anisotropy = anisotropy;
                if (material.name === 'AmberGlassBaked') {
                    const map = material.emissiveMap || material.map;
                    if (map) map.anisotropy = anisotropy;
                    object.material = new THREE.MeshBasicMaterial({ map, side: THREE.FrontSide });
                    object.material.name = 'AmberGlassBaked';
                }
                if (material.name === 'Babel supplied cover') {
                    material.color.setRGB(0.32, 0.30, 0.20);
                    material.roughness = 0.94;
                    material.emissive.set(0x000000);
                }
                if (material.name === 'CigaretteEmber') this.ember = material;
            }
        });
        this.model.updateMatrixWorld(true);
        const origin = this.model.getObjectByName('CigaretteSmokeOrigin');
        const material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            uniforms: { uTime: { value: 0 } },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                varying vec2 vUv;
                void main() {
                    float y = vUv.y;
                    float drift = sin(y * 8.0 - uTime * 0.65) * y * 0.16
                                + sin(y * 19.0 - uTime * 0.9) * y * 0.035;
                    float width = 0.009 + y * 0.095;
                    float x = vUv.x - 0.5 - drift;
                    float core = exp(-x * x / (width * width));
                    float wisps = 0.65 + 0.35 * sin(y * 32.0 - uTime * 1.35);
                    float fade = smoothstep(0.0, 0.045, y) * pow(1.0 - y, 1.8);
                    gl_FragColor = vec4(0.68, 0.70, 0.72, core * wisps * fade * 0.25);
                }
            `,
        });
        const geometry = new THREE.PlaneGeometry(280, 700);
        geometry.translate(0, 350, 0);
        this.smoke = new THREE.Mesh(geometry, material);
        this.smoke.name = 'Cigarette smoke';
        if (origin) origin.getWorldPosition(this.smoke.position);
        this.smoke.visible = !!origin && !this.reducedMotion.matches;
        app.scene.add(this.smoke);
    }

    update() {
        const animate = !this.reducedMotion.matches && !document.hidden;
        if (animate) this.elapsed += Math.min(this.application.time.delta, 50) * 0.001;
        this.smoke.visible = animate;
        this.smoke.material.uniforms.uTime.value = this.elapsed;
        // Cylindrical billboard stays upright while following room/desk camera views.
        const camera = this.application.camera.instance;
        this.smoke.rotation.y = Math.atan2(camera.position.x - this.smoke.position.x,
            camera.position.z - this.smoke.position.z);
        if (this.ember) this.ember.emissiveIntensity = animate ? 0.75 + Math.sin(this.elapsed * 0.7) * 0.12 : 0.75;
    }
}
