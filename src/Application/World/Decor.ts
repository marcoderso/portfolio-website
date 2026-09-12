import * as THREE from 'three';
import Application from '../Application';
import BakedModel from '../Utils/BakedModel';
import Resources from '../Utils/Resources';

export default class Decor {
    application: Application;
    scene: THREE.Scene;
    resources: Resources;
    bakedModel: BakedModel;

    constructor() {
        this.application = new Application();
        this.scene = this.application.scene;
        this.resources = this.application.resources;

        this.bakeModel();
        this.setModel();
    }

    bakeModel() {
        this.bakedModel = new BakedModel(
            this.resources.items.gltfModel.decorModel,
            this.resources.items.texture.decorTexture,
            900
        );
    }

    setModel() {
        for (const name of ['binder_1', 'binder_2', 'paper', 'paper_stack_1',
            'paper_stack_2', 'paper_holder_bottom', 'paper_holder_top']) {
            const binder = this.bakedModel.getModel().getObjectByName(name);
            if (binder) binder.visible = false;
        }
        this.scene.add(this.bakedModel.getModel());
    }
}
