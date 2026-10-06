import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Character } from './Character';
import { Socket } from 'socket.io-client';

const SPEED_WALK = 4;
const SPEED_RUN = 10;
const JUMP_FORCE = 10;
const GRAVITY = 30;

export function LocalPlayer({ socket }: { socket: Socket | null }) {
  const posRef = useRef(new THREE.Vector3(0, 0, 0));
  const rotRef = useRef(0);
  const animRef = useRef('idle');
  const velocityY = useRef(0);
  const keys = useRef<{ [key: string]: boolean }>({});
  const walkStartTime = useRef<number | null>(null);

  // For reacting to changes to send to character
  const [characterState, setCharacterState] = React.useState({ position: [0,0,0] as [number,number,number], rotation: 0, animation: 'idle' });

  const { camera } = useThree();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && !walkStartTime.current) {
        walkStartTime.current = Date.now();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        const anyArrow = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].some(key => keys.current[key]);
        if (!anyArrow) {
          walkStartTime.current = null;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Throttle socket emits
  const lastEmit = useRef(0);

  useFrame((state, delta) => {
    let currentAnim = 'idle';
    const isShiftRun = keys.current['ShiftLeft'] || keys.current['ShiftRight'];
    const isAutoRun = walkStartTime.current && (Date.now() - walkStartTime.current) > 2000;
    const isRunning = isShiftRun || isAutoRun;

    const moveSpeed = isRunning ? SPEED_RUN : SPEED_WALK;

    const moveDir = new THREE.Vector3(0, 0, 0);
    if (keys.current['ArrowUp']) moveDir.z -= 1;
    if (keys.current['ArrowDown']) moveDir.z += 1;
    if (keys.current['ArrowLeft']) moveDir.x -= 1;
    if (keys.current['ArrowRight']) moveDir.x += 1;

    let moved = false;

    if (moveDir.length() > 0) {
      moveDir.normalize();
      currentAnim = isRunning ? 'run' : 'walk';
      
      posRef.current.addScaledVector(moveDir, moveSpeed * delta);
      rotRef.current = Math.atan2(moveDir.x, moveDir.z);
      moved = true;
    }

    // Jump logic
    if (keys.current['Space'] && posRef.current.y <= 0) {
      velocityY.current = JUMP_FORCE;
    }

    // Apply gravity
    if (posRef.current.y > 0 || velocityY.current > 0) {
      velocityY.current -= GRAVITY * delta;
      posRef.current.y += velocityY.current * delta;
      if (posRef.current.y < 0) {
        posRef.current.y = 0;
        velocityY.current = 0;
      }
      if (posRef.current.y > 0) currentAnim = 'jump';
      moved = true;
    }

    if (currentAnim !== animRef.current) {
      animRef.current = currentAnim;
      moved = true;
    }

    // Update state for Character component to render
    setCharacterState({
      position: [posRef.current.x, posRef.current.y, posRef.current.z],
      rotation: rotRef.current,
      animation: animRef.current
    });

    // Smooth camera follow
    const targetCameraPos = new THREE.Vector3(posRef.current.x, posRef.current.y + 15, posRef.current.z + 10);
    camera.position.lerp(targetCameraPos, 5 * delta); // smooth interpolation
    
    // Look at player slightly ahead
    const lookAtTarget = new THREE.Vector3(posRef.current.x, posRef.current.y, posRef.current.z);
    camera.lookAt(lookAtTarget);

    // Network sync
    if (socket && moved) {
      const now = Date.now();
      if (now - lastEmit.current > 50) { // limit to ~20hz
        socket.emit('playerMovement', { 
          x: posRef.current.x, 
          y: posRef.current.y, 
          z: posRef.current.z, 
          rotation: rotRef.current, 
          animation: animRef.current 
        });
        lastEmit.current = now;
      }
    } else if (socket && !moved && animRef.current === 'idle') {
      // Ensure we send the final idle state
      const now = Date.now();
      if (now - lastEmit.current > 50 && lastEmit.current !== -1) {
        socket.emit('playerMovement', { 
          x: posRef.current.x, 
          y: posRef.current.y, 
          z: posRef.current.z, 
          rotation: rotRef.current, 
          animation: 'idle' 
        });
        lastEmit.current = -1; // -1 means we are idle and already emitted
      }
    }
  });

  return <Character position={characterState.position} rotation={characterState.rotation} animation={characterState.animation} />;
}
