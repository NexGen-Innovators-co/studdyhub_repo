import React, { useRef, useEffect, useCallback, memo, MutableRefObject, Dispatch, SetStateAction } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface ThreeJSRendererProps {
    codeContent: string | undefined;
    canvasRef: MutableRefObject<HTMLCanvasElement | null>;
    onInvalidCode: Dispatch<SetStateAction<string | null>>;
    onSceneReady: (scene: THREE.Scene, renderer: THREE.WebGLRenderer, cleanup: () => void) => void;
}

export const ThreeJsRenderer = memo(({ codeContent, canvasRef, onInvalidCode, onSceneReady }: ThreeJSRendererProps) => {
    const animationFrameIdRef = useRef<number | null>(null);
    const cleanupRef = useRef<(() => void) | null>(null);
    const sceneInitializedRef = useRef<boolean>(false);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const startTimeRef = useRef<number>(0);
    const lastFrameTimeRef = useRef<number>(0);

    const initializeScene = useCallback(() => {
        if (!canvasRef.current || !codeContent || sceneInitializedRef.current) {
            return;
        }

        sceneInitializedRef.current = true;
        ////console.log("[ThreeJSRenderer] Initializing Three.js scene.");

        // Cleanup previous scene
        if (cleanupRef.current) {
            ////console.log("[ThreeJSRenderer] Cleaning up previous scene.");
            cleanupRef.current();
            cleanupRef.current = null;
        }
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
            animationFrameIdRef.current = null;
        }

        try {
            const createSceneWrapper = new Function('THREE', 'OrbitControls', 'GLTFLoader', `
        ${codeContent}
        return createThreeJSScene;
      `);

            const createScene = createSceneWrapper(THREE, OrbitControls, GLTFLoader);

            if (typeof createScene !== 'function') {
                throw new Error('createThreeJSScene is not a function.');
            }

            const { scene, renderer, camera, controls, cleanup } = createScene(canvasRef.current, THREE, OrbitControls, GLTFLoader);

            // Validate returned objects
            if (!scene || !(scene instanceof THREE.Scene)) {
                throw new Error('createThreeJSScene did not return a valid scene.');
            }
            if (!renderer || !(renderer instanceof THREE.WebGLRenderer)) {
                throw new Error('createThreeJSScene did not return a valid renderer.');
            }
            if (!camera || !(camera instanceof THREE.PerspectiveCamera)) {
                throw new Error('createThreeJSScene did not return a valid camera.');
            }
            if (!controls || !(controls instanceof OrbitControls)) {
                throw new Error('createThreeJSScene did not return valid controls.');
            }
            if (!cleanup || typeof cleanup !== 'function') {
                throw new Error('createThreeJSScene did not return a valid cleanup function.');
            }

            // Store references
            cleanupRef.current = cleanup;
            sceneRef.current = scene;
            rendererRef.current = renderer;
            cameraRef.current = camera;
            controlsRef.current = controls;
            startTimeRef.current = Date.now();
            lastFrameTimeRef.current = Date.now();

            // Enhanced animation loop with better orbital mechanics
            const animate = () => {
                animationFrameIdRef.current = requestAnimationFrame(animate);
                const currentTime = Date.now();
                const elapsedTime = (currentTime - startTimeRef.current) / 1000;
                const deltaTime = (currentTime - lastFrameTimeRef.current) / 1000;
                lastFrameTimeRef.current = currentTime;

                if (controlsRef.current) {
                    controlsRef.current.update();
                }

                if (rendererRef.current && sceneRef.current && cameraRef.current) {
                    try {
                        // Enhanced animation system
                        sceneRef.current.traverse((obj) => {
                            if (obj instanceof THREE.Mesh || obj instanceof THREE.Group) {
                                // Handle orbital motion
                                if (obj.hasOwnProperty('orbitRadius') && obj.hasOwnProperty('orbitSpeed')) {
                                    const orbitRadius = (obj as any).orbitRadius;
                                    const orbitSpeed = (obj as any).orbitSpeed;
                                    const orbitCenter = (obj as any).orbitCenter || new THREE.Vector3(0, 0, 0);

                                    const angle = elapsedTime * orbitSpeed;
                                    obj.position.x = orbitCenter.x + Math.cos(angle) * orbitRadius;
                                    obj.position.z = orbitCenter.z + Math.sin(angle) * orbitRadius;
                                    obj.position.y = orbitCenter.y + (obj as any).orbitHeight || 0;
                                }

                                // Handle rotation
                                if (obj.hasOwnProperty('rotationSpeed')) {
                                    const rotationSpeed = (obj as any).rotationSpeed;
                                    if (typeof rotationSpeed === 'number') {
                                        obj.rotation.y += rotationSpeed * deltaTime * 60; // 60fps normalized
                                    } else if (typeof rotationSpeed === 'object') {
                                        obj.rotation.x += (rotationSpeed.x || 0) * deltaTime * 60;
                                        obj.rotation.y += (rotationSpeed.y || 0) * deltaTime * 60;
                                        obj.rotation.z += (rotationSpeed.z || 0) * deltaTime * 60;
                                    }
                                }

                                // Handle scaling animations
                                if (obj.hasOwnProperty('scaleAnimation')) {
                                    const scaleAnim = (obj as any).scaleAnimation;
                                    if (scaleAnim.type === 'pulse') {
                                        const scale = 1 + Math.sin(elapsedTime * (scaleAnim.speed || 1)) * (scaleAnim.amplitude || 0.1);
                                        obj.scale.setScalar(scale);
                                    }
                                }

                                // Handle custom update functions
                                if (obj.hasOwnProperty('customUpdate') && typeof (obj as any).customUpdate === 'function') {
                                    (obj as any).customUpdate(elapsedTime, deltaTime);
                                }
                            }
                        });

                        // Handle post-processing effects if present
                        if (sceneRef.current.userData?.postProcessUpdate) {
                            sceneRef.current.userData.postProcessUpdate(elapsedTime, deltaTime);
                        }

                        rendererRef.current.render(sceneRef.current, cameraRef.current);
                    } catch (renderError) {
                        //console.error("[ThreeJSRenderer] Rendering error:", renderError);
                        cancelAnimationFrame(animationFrameIdRef.current!);
                        animationFrameIdRef.current = null;
                        onInvalidCode(`Error during rendering: ${renderError.message}`);
                    }
                }
            };

            // Start animation loop
            animationFrameIdRef.current = requestAnimationFrame(animate);

            // Resize handler with proper aspect ratio handling
            const handleResize = () => {
                if (canvasRef.current && rendererRef.current && cameraRef.current) {
                    const width = canvasRef.current.clientWidth;
                    const height = canvasRef.current.clientHeight;

                    rendererRef.current.setSize(width, height);
                    cameraRef.current.aspect = width / height;
                    cameraRef.current.updateProjectionMatrix();

                    // Handle post-processing resize if present
                    if (sceneRef.current?.userData?.onResize) {
                        sceneRef.current.userData.onResize(width, height);
                    }
                }
            };

            window.addEventListener('resize', handleResize);
            handleResize();

            onSceneReady(scene, renderer, cleanup);
            onInvalidCode(null);
            ////console.log("[ThreeJSRenderer] Scene initialized successfully.");

            // Return cleanup function
            return () => {
                ////console.log("[ThreeJSRenderer] Cleaning up on unmount.");
                if (animationFrameIdRef.current) {
                    cancelAnimationFrame(animationFrameIdRef.current);
                    animationFrameIdRef.current = null;
                }
                if (cleanupRef.current) {
                    cleanupRef.current();
                    cleanupRef.current = null;
                }
                window.removeEventListener('resize', handleResize);
                sceneInitializedRef.current = false;
                sceneRef.current = null;
                rendererRef.current = null;
                cameraRef.current = null;
                controlsRef.current = null;
            };

        } catch (error) {
            //console.error("[ThreeJSRenderer] Error initializing Three.js scene:", error);
            onInvalidCode(`Error rendering 3D scene: ${error.message}`);

            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                    ctx.fillStyle = '#ef4444';
                    ctx.font = '16px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('Error rendering 3D scene.', canvasRef.current.width / 2, canvasRef.current.height / 2);
                    ctx.fillText('Check //console for details.', canvasRef.current.width / 2, canvasRef.current.height / 2 + 20);
                }
            }
            sceneInitializedRef.current = false;
        }
    }, [codeContent, canvasRef, onInvalidCode, onSceneReady]);

    useEffect(() => {
        const timeoutId = setTimeout(initializeScene, 100);
        return () => clearTimeout(timeoutId);
    }, [initializeScene]);

    return null;
});