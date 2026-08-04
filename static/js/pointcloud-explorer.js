import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";

const activeViewers = new Set();
const loader = new PLYLoader();
let activeSequence = null;

class PointCloudViewer {
  constructor(element) {
    this.element = element;
    this.viewport = element.querySelector("[data-pointcloud-viewport]");
    this.loading = element.querySelector("[data-pointcloud-loading]");
    this.resetButton = element.querySelector("[data-pointcloud-reset]");
    this.sequence = element.dataset.sequence;
    this.model = element.dataset.model;
    this.disposed = false;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf5f5f2);

    this.camera = new THREE.PerspectiveCamera(34, 1, 0.01, 10000);
    this.camera.up.set(0, 0, 1);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.setAttribute(
      "aria-label",
      `${this.model === "vggtlong" ? "VGGT-Long" : "SLAMFormer-Infinity"} Sequence ${this.sequence} interactive point cloud`
    );
    this.viewport.prepend(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = false;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 0.01;
    this.controls.maxDistance = 10000;
    this.controls.addEventListener("change", () => this.render());

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.viewport);
    this.resetButton.addEventListener("click", () => this.resetView());
    this.load();
  }

  load() {
    const url = `./static/pointcloud/${this.model}/${this.sequence}.ply`;
    this.setStatus("Loading point cloud…");

    loader.load(
      url,
      (geometry) => {
        if (this.disposed) {
          geometry.dispose();
          return;
        }

        geometry.computeBoundingBox();
        const bounds = geometry.boundingBox;
        const center = bounds.getCenter(new THREE.Vector3());
        geometry.translate(-center.x, -center.y, -center.z);
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();

        const size = geometry.boundingBox.getSize(new THREE.Vector3());
        this.modelSize = Math.max(size.x, size.z, size.y * 2, 0.001);
        this.material = new THREE.PointsMaterial({
          size: this.modelSize / 720,
          sizeAttenuation: true,
          vertexColors: geometry.hasAttribute("color")
        });
        this.points = new THREE.Points(geometry, this.material);
        this.scene.add(this.points);
        this.setStatus("");
        this.resetView();
      },
      (event) => {
        if (!event.total) return;
        const progress = Math.min(99, Math.round((event.loaded / event.total) * 100));
        this.setStatus(`Loading point cloud · ${progress}%`);
      },
      () => {
        if (!this.disposed) this.setStatus("Point cloud could not be loaded");
      }
    );
  }

  setStatus(message) {
    this.loading.textContent = message;
    this.loading.hidden = !message;
  }

  resetView() {
    if (!this.modelSize) return;
    const distance =
      (this.modelSize / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)))) * 1.18;
    this.camera.near = Math.max(this.modelSize / 5000, 0.001);
    this.camera.far = distance * 20;
    this.camera.position.set(0, -distance, 0.0001);
    this.camera.up.set(0, 0, 1);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.render();
  }

  resize() {
    if (this.disposed) return;
    const width = this.viewport.clientWidth;
    const height = this.viewport.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  render() {
    if (!this.disposed) this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    this.resizeObserver.disconnect();
    this.controls.dispose();
    if (this.points) {
      this.points.geometry.dispose();
      this.material.dispose();
      this.scene.remove(this.points);
    }
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

function activateSequence(sequence) {
  if (activeSequence === sequence && activeViewers.size) return;
  activeSequence = sequence;

  for (const viewer of activeViewers) viewer.dispose();
  activeViewers.clear();

  const panel = document.querySelector(`[data-sequence-panel="${sequence}"]`);
  if (!panel || panel.hidden) return;

  panel.querySelectorAll("[data-pointcloud-viewer]").forEach((element) => {
    activeViewers.add(new PointCloudViewer(element));
  });
}

window.addEventListener("sequencechange", (event) => {
  window.requestAnimationFrame(() => activateSequence(event.detail.sequence));
});

const initialSequence =
  document.querySelector("[data-sequence-tab].is-active")?.dataset.sequenceTab || "02";
window.requestAnimationFrame(() => activateSequence(initialSequence));
