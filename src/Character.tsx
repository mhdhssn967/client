import { useRef, useEffect, useMemo } from 'react';
import { useGLTF, useAnimations, Html } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';

export function Character({ position, rotation, animation = 'idle', color = '#333333', hp }: { position: [number, number, number], rotation: number, animation?: string, color?: string, hp?: number }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('/new_character.glb');
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { actions } = useAnimations(animations, group);

  const stripeTex = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#ff3333';
    for(let i=0; i<128; i+=32) ctx.fillRect(i, 0, 16, 128);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }, []);

  useEffect(() => {
    let handBone: THREE.Object3D | undefined;
    
    clone.traverse((child) => {
      if (child.name.includes('LeftHandIndex2')) {
        handBone = child;
      }
      
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach(mat => {
            if (mat.name === 'outfit_color' && mat instanceof THREE.MeshStandardMaterial) {
              mesh.material = mat.clone();
              (mesh.material as THREE.MeshStandardMaterial).color.set(color);
            }
          });
        }
      }
    });

    if (handBone) {
      let heldBall = handBone.getObjectByName('held_ball');
      if (!heldBall) {
        heldBall = new THREE.Mesh(
          new THREE.SphereGeometry(0.25, 32, 32),
          new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.4 })
        );
        heldBall.name = 'held_ball';
        heldBall.position.set(0, 0.2, 0); // slight offset so it fits in hand
        handBone.add(heldBall);
      }
    }
  }, [clone, color, stripeTex]);

  useEffect(() => {
    let actionName = Object.keys(actions).find((k) => k.toLowerCase().includes(animation.toLowerCase()));
    
    if (!actionName && animation !== 'idle') {
       actionName = Object.keys(actions).find((k) => k.toLowerCase().includes('idle'));
    }
    
    let currentAction = actions[actionName || ''];
    let idleTimer: number | null = null;
    let throwTimer: number | null = null;

    if (currentAction) {
      if (animation === 'idle') {
        const idle1Name = Object.keys(actions).find((k) => k.toLowerCase().includes('idle') && !k.toLowerCase().includes('2')) || actionName;
        const idle2Name = Object.keys(actions).find((k) => k.toLowerCase().includes('idle2')) || idle1Name;
        
        currentAction = actions[idle1Name || ''];
        currentAction?.reset().fadeIn(0.2).play();

        const loopIdle = () => {
          idleTimer = setTimeout(() => {
            const nextAction = Math.random() > 0.5 ? actions[idle1Name || ''] : actions[idle2Name || ''];
            if (nextAction && nextAction !== currentAction) {
              nextAction.reset().fadeIn(0.5).play();
              currentAction?.fadeOut(0.5);
              currentAction = nextAction;
            }
            loopIdle();
          }, Math.random() * 4000 + 3000);
        };
        loopIdle();
      } else {
        currentAction.reset().fadeIn(0.2);

        if (animation.includes('throw')) {
          currentAction.setLoop(THREE.LoopOnce, 1);
          currentAction.clampWhenFinished = true;
        } else {
          currentAction.setLoop(THREE.LoopRepeat, Infinity);
          currentAction.clampWhenFinished = false;
        }

        currentAction.play();
      }
      
      let heldBall: THREE.Object3D | undefined;
      clone.traverse(c => { if(c.name === 'held_ball') heldBall = c; });
      
      if (heldBall) {
        if (animation.includes('throw')) {
          heldBall.visible = true;
          throwTimer = setTimeout(() => {
            if (heldBall) heldBall.visible = false;
          }, 600);
        } else {
          heldBall.visible = false;
        }
      }

      return () => {
        currentAction?.fadeOut(0.2);
        if (idleTimer) clearTimeout(idleTimer);
        if (throwTimer) clearTimeout(throwTimer);
      };
    }
  }, [animation, actions]);

  return (
    <group ref={group} position={position} rotation={[0, rotation, 0]} scale={4} dispose={null}>
      {hp !== undefined && (
        <Html position={[0, 1.2, 0]} center zIndexRange={[100, 0]}>
          <div style={{ width: '40px', height: '6px', background: 'rgba(255,0,0,0.8)', border: '1px solid rgba(0,0,0,0.5)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(0, hp)}%`, height: '100%', background: '#4CAF50', transition: 'width 0.2s ease-out' }} />
          </div>
        </Html>
      )}
      <primitive object={clone} />
    </group>
  );
}

useGLTF.preload('/new_character.glb');
