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

    const initializeScene = useCallback(() => {
        if (!canvasRef.current || !codeContent || sceneInitializedRef.current) {
            return;
        }

        sceneInitializedRef.current = true;

        console.log("[ThreeJSRenderer] Initializing Three.js scene.");

        if (cleanupRef.current) {
            console.log("[ThreeJSRenderer] Cleaning up previous scene.");
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
            const { scene, renderer, camera, controls, cleanup } = createScene(canvasRef.current, THREE, OrbitControls, GLTFLoader);

            cleanupRef.current = cleanup;

            const animate = () => {
                controls.update();
                renderer.render(scene, camera);
                animationFrameIdRef.current = requestAnimationFrame(animate);
            };

            animationFrameIdRef.current = requestAnimationFrame(animate);

            onSceneReady(scene, renderer, cleanup);
            onInvalidCode(null);
            console.log("[ThreeJSRenderer] Scene initialized successfully.");

            const handleResize = () => {
                if (canvasRef.current && renderer) {
                    const width = canvasRef.current.clientWidth;
                    const height = canvasRef.current.clientHeight;
                    renderer.setSize(width, height);
                    camera.aspect = width / height;
                    camera.updateProjectionMatrix();
                    renderer.setPixelRatio(window.devicePixelRatio);
                    renderer.render(scene, camera);
                }
            };

            window.addEventListener('resize', handleResize);
            handleResize();

            return () => {
                console.log("[ThreeJSRenderer] Cleaning up on unmount.");
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
            };
        } catch (error) {
            console.error("[ThreeJSRenderer] Error initializing Three.js scene:", error);
            onInvalidCode(`Error rendering 3D scene: ${error.message}`);
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                    ctx.fillStyle = '#ef4444';
                    ctx.font = '16px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('Error rendering 3D scene.', canvasRef.current.width / 2, canvasRef.current.height / 2);
                    ctx.fillText('Check console for details.', canvasRef.current.width / 2, canvasRef.current.height / 2 + 20);
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