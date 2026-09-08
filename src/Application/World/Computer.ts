import * as THREE from 'three';
import Application from '../Application';
import Resources from '../Utils/Resources';

export default class Computer {
    application: Application;
    scene: THREE.Scene;
    resources: Resources;
    model: THREE.Group;

    constructor() {
        this.application = new Application();
        this.scene = this.application.scene;
        this.resources = this.application.resources;

        this.setModel();
    }

    setModel() {
        this.model = this.resources.items.gltfModel.computerSetupModel.scene;
        const map = this.resources.items.texture.computerAlbedoTexture;
        const lightMap = this.resources.items.texture.computerSetupTexture;
        const anisotropy = this.application.renderer.instance.capabilities.getMaxAnisotropy();

        for (const texture of [map, lightMap]) {
            texture.flipY = false;
            texture.encoding = THREE.sRGBEncoding;
            texture.anisotropy = anisotropy;
        }

        // Printing is part of the actual surface (UV0). Lighting has its own UV1
        // so small letters retain their resolution and cannot fight with the casing.
        const material = new THREE.MeshBasicMaterial({ map, lightMap, lightMapIntensity: 4 });
        this.model.traverse((child) => {
            if (child instanceof THREE.Mesh) child.material = material;
        });
        this.model.scale.setScalar(900);
        this.scene.add(this.model);
    }
}
