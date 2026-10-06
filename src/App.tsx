import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Sky, Grid, Line, Html } from '@react-three/drei';
import { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { Character } from './Character';
import { io, Socket } from 'socket.io-client';

type PlayerState = { x: number; y: number; z: number; rotation: number; animation: string; color?: string; hp?: number };
type PlayersState = Record<string, PlayerState>;

const mobileInput = {
  x: 0, z: 0, run: false, throw: false, throwPower: 1, throwAngle: null as number | null, throwCancel: false, cameraAngle: 0, cameraPitch: 0
};

function MobileControls({ hasBall }: { hasBall: boolean }) {
  const [isMobile, setIsMobile] = useState(false);
  const [stickPos, setStickPos] = useState({ x: 0, y: 0 });
  const [throwStickPos, setThrowStickPos] = useState({ x: 0, y: 0 });
  const [isThrowCancel, setIsThrowCancel] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const baseRef = useRef<HTMLDivElement>(null);
  const throwRef = useRef<HTMLButtonElement>(null);
  const throwBaseRadius = 100;
  
  const baseRadius = 50; 
  const runThreshold = 35; 

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.matchMedia("(max-width: 768px)").matches || 'ontouchstart' in window);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    document.body.style.touchAction = 'none';

    let lastTouch: { x: number, y: number } | null = null;
    let touchId: number | null = null;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName.toLowerCase() === 'button' || target.closest('button')) return;
      if (touchId !== null) return;
      touchId = e.pointerId;
      lastTouch = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId === touchId && lastTouch) {
        const dx = e.clientX - lastTouch.x;
        const dy = e.clientY - lastTouch.y;
        mobileInput.cameraAngle -= dx * 0.015;
        mobileInput.cameraPitch -= dy * 0.015;
        mobileInput.cameraPitch = Math.max(-0.4, Math.min(0.8, mobileInput.cameraPitch));
        lastTouch = { x: e.clientX, y: e.clientY };
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId === touchId) {
        touchId = null;
        lastTouch = null;
      }
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      document.body.style.touchAction = '';
    };
  }, []);

  if (!isMobile) return null;

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!baseRef.current) return;
    const rect = baseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    let dx = e.clientX - centerX;
    let dy = e.clientY - centerY;
    
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > baseRadius) {
      dx = (dx / distance) * baseRadius;
      dy = (dy / distance) * baseRadius;
    }
    
    setStickPos({ x: dx, y: dy });
    
    mobileInput.x = dx / baseRadius;
    mobileInput.z = dy / baseRadius;
    
    const run = distance > runThreshold;
    mobileInput.run = run;
    setIsRunning(run);
  };

  const handlePointerUp = () => {
    setStickPos({ x: 0, y: 0 });
    setIsRunning(false);
    mobileInput.x = 0;
    mobileInput.z = 0;
    mobileInput.run = false;
  };

  const handleThrowPointerMove = (e: React.PointerEvent) => {
    if (!throwRef.current) return;
    const rect = throwRef.current.parentElement!.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let dx = e.clientX - centerX;
    let dy = e.clientY - centerY;
    
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > throwBaseRadius) {
       dx = (dx / dist) * throwBaseRadius;
       dy = (dy / dist) * throwBaseRadius;
    }
    
    setThrowStickPos({ x: dx, y: dy });
    
    if (dist > 15) {
      setIsThrowCancel(false);
      mobileInput.throwCancel = false;
      mobileInput.throwAngle = Math.atan2(dx, dy);
      mobileInput.throwPower = 0.5 + (dist / throwBaseRadius) * 1.0;
    } else {
      setIsThrowCancel(true);
      mobileInput.throwCancel = true;
      mobileInput.throwAngle = null;
    }
  };

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
      <div 
        ref={baseRef}
        style={{ 
          position: 'absolute', 
          bottom: '40px', 
          left: '40px', 
          width: '120px', 
          height: '120px', 
          background: 'rgba(255,255,255,0.2)', 
          border: '2px solid rgba(255,255,255,0.5)',
          borderRadius: '50%', 
          pointerEvents: 'auto',
          touchAction: 'none'
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId);
          handlePointerMove(e);
        }}
        onPointerMove={(e) => {
          handlePointerMove(e);
        }}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '50px',
          height: '50px',
          background: isRunning ? 'rgba(255,100,100,0.8)' : 'rgba(255,255,255,0.8)',
          borderRadius: '50%',
          transform: `translate(calc(-50% + ${stickPos.x}px), calc(-50% + ${stickPos.y}px))`,
          boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
          transition: (stickPos.x === 0 && stickPos.y === 0) ? 'transform 0.15s ease-out' : 'none'
        }} />
      </div>
      
      {hasBall && (
        <div style={{ position: 'absolute', bottom: '20px', right: '20px', width: '200px', height: '200px', background: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto' }}>
          <button 
            ref={throwRef}
            style={{ 
              width: '80px', height: '80px', borderRadius: '50%', 
              background: isThrowCancel ? 'rgba(100,100,100,0.8)' : 'rgba(255,100,100,0.8)', color: 'white', 
              border: '2px solid rgba(255,255,255,0.5)', 
              fontSize: isThrowCancel ? '10px' : '14px', fontWeight: 'bold', boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
              touchAction: 'none',
              transform: `translate(${throwStickPos.x}px, ${throwStickPos.y}px)`
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              mobileInput.throw = true;
              mobileInput.throwPower = 1;
              mobileInput.throwCancel = false;
              mobileInput.throwAngle = null;
              setIsThrowCancel(false);
              setThrowStickPos({ x: 0, y: 0 });
            }}
            onPointerMove={(e) => {
              handleThrowPointerMove(e);
            }}
            onPointerUp={() => {
              mobileInput.throw = false;
              setThrowStickPos({ x: 0, y: 0 });
              setIsThrowCancel(false);
            }}
            onPointerCancel={() => {
              mobileInput.throw = false;
              setThrowStickPos({ x: 0, y: 0 });
              setIsThrowCancel(false);
            }}
            onContextMenu={e => e.preventDefault()}
          >
            {isThrowCancel ? 'CANCEL' : 'THROW'}
          </button>
        </div>
      )}
    </div>
  );
}

function Projectiles({ newBalls, socket, localSocketId, currentPosition }: { newBalls: any[], socket: Socket | null, localSocketId: string, currentPosition: React.MutableRefObject<THREE.Vector3> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const ballsData = useRef<{id: string, owner: string, p: THREE.Vector3, v: THREE.Vector3, q: THREE.Quaternion, active: boolean, life: number, hasHit: boolean}[]>([]);

  useEffect(() => {
    newBalls.forEach(nb => {
      if (!ballsData.current.find(b => b.id === nb.id)) {
        ballsData.current.push({
          id: nb.id,
          owner: nb.owner,
          p: new THREE.Vector3(nb.startPos.x, nb.startPos.y, nb.startPos.z),
          v: new THREE.Vector3(nb.velocity.x, nb.velocity.y, nb.velocity.z),
          q: new THREE.Quaternion(),
          active: true,
          life: 0,
          hasHit: false
        });
      }
    });
  }, [newBalls]);

  const stripeTexture = useMemo(() => {
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

  useFrame((_state, delta) => {
    if (!meshRef.current) return;
    meshRef.current.count = ballsData.current.length;
    const dummy = new THREE.Object3D();
    const radius = 0.2;
    
    for (let i = 0; i < ballsData.current.length; i++) {
      const b = ballsData.current[i];
      if (!b.active) {
        dummy.position.set(0, -100, 0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        continue;
      }
      
      b.life += delta;
      if (b.life > 10) { b.active = false; continue; }

      b.v.y -= 15 * delta;
      b.p.addScaledVector(b.v, delta);
      
      if (b.p.y < radius) {
        b.p.y = radius;
        b.v.y *= -0.6;
        b.v.x *= 0.98;
        b.v.z *= 0.98;
        if (b.v.length() < 0.5) b.v.set(0,0,0);
      }
      
      const speed = b.v.length();
      if (speed === 0 && b.p.y <= radius + 0.05) {
        if (b.active) {
          b.active = false;
          if (b.owner === localSocketId && socket) {
            socket.emit('ballLanded', { x: b.p.x, z: b.p.z });
          }
        }
      }

      if (b.active && !b.hasHit && b.owner !== localSocketId && speed > 1) {
        const distToPlayer = Math.sqrt(Math.pow(b.p.x - currentPosition.current.x, 2) + Math.pow(b.p.z - currentPosition.current.z, 2));
        const distY = Math.abs(b.p.y - (currentPosition.current.y + 2.0));
        
        if (distToPlayer < 1.2 && distY < 2.0) {
          b.hasHit = true;
          b.v.x *= -0.5;
          b.v.z *= -0.5;
          b.v.y = 5;
          if (socket) {
            socket.emit('playerHit', { damage: 20 });
          }
        }
      }
      
      if (b.v.lengthSq() > 0.1) {
        const axis = new THREE.Vector3(b.v.z, 0, -b.v.x).normalize();
        const angularSpeed = b.v.length() / radius;
        const qTurn = new THREE.Quaternion().setFromAxisAngle(axis, angularSpeed * delta);
        b.q.premultiply(qTurn);
      }

      dummy.position.copy(b.p);
      dummy.quaternion.copy(b.q);
      dummy.scale.set(radius, radius, radius);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, 100]} castShadow receiveShadow>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial map={stripeTexture} roughness={0.4} />
    </instancedMesh>
  );
}

function PickupBalls({ balls, onPickup, currentPosition }: { balls: any[], onPickup: (id: string) => void, currentPosition: React.MutableRefObject<THREE.Vector3> }) {
  const [nearBallId, setNearBallId] = useState<string | null>(null);

  useFrame(() => {
    let closestId: string | null = null;
    let closestDist = 2.5; 
    balls.forEach(b => {
      const dist = Math.sqrt(Math.pow(currentPosition.current.x - b.x, 2) + Math.pow(currentPosition.current.z - b.z, 2));
      if (dist < closestDist) {
        closestDist = dist;
        closestId = b.id;
      }
    });
    if (nearBallId !== closestId) {
       setNearBallId(closestId);
    }
  });

  return (
    <>
      {balls.map(b => (
        <mesh key={b.id} position={[b.x, 0.25, b.z]}>
           <sphereGeometry args={[0.25, 16, 16]} />
           <meshStandardMaterial color="#ff3333" roughness={0.4} />
           {nearBallId === b.id && (
             <Html position={[0, 0.5, 0]} center zIndexRange={[100, 0]}>
               <button 
                 onPointerDown={(e) => { e.stopPropagation(); onPickup(b.id); }}
                 style={{ 
                   padding: '8px 16px', background: 'rgba(255,255,255,0.9)', color: 'black', 
                   border: '2px solid black', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold',
                   pointerEvents: 'auto', userSelect: 'none'
                 }}
               >
                 Pick Up
               </button>
             </Html>
           )}
        </mesh>
      ))}
    </>
  );
}

function PlayerCharacter({ socket, color, hp, hasBall, setHasBall, currentPosition }: { socket: Socket | null, color: string, hp: number, hasBall: boolean, setHasBall: (v: boolean) => void, currentPosition: React.MutableRefObject<THREE.Vector3> }) {
  const [keys, setKeys] = useState({
    w: false, a: false, s: false, d: false, f: false,
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
    Shift: false
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => setKeys(k => ({ ...k, [e.key]: true }));
    const handleKeyUp = (e: KeyboardEvent) => setKeys(k => ({ ...k, [e.key]: false }));
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const currentRotation = useRef(0);
  
  const [characterState, setCharacterState] = useState({
    position: [0, 0, 0] as [number, number, number],
    rotation: 0,
    animation: 'idle'
  });

  const speedWalk = 5;
  const speedRun = 12;

  const throwPhase = useRef<'idle' | 'windup' | 'release'>('idle');
  const releaseTimer = useRef<number | null>(null);
  const [trajectoryPoints, setTrajectoryPoints] = useState<THREE.Vector3[]>([]);
  const lastTrajUpdate = useRef({ x: 0, z: 0, rot: 0, power: 1 });

  useFrame((state, delta) => {
    let inputX = mobileInput.x;
    let inputZ = mobileInput.z;
    
    if (keys.w || keys.ArrowUp) inputZ -= 1;
    if (keys.s || keys.ArrowDown) inputZ += 1;
    if (keys.a || keys.ArrowLeft) inputX -= 1;
    if (keys.d || keys.ArrowRight) inputX += 1;

    let isMoving = false;
    let intensity = 1;
    
    if (inputX !== 0 || inputZ !== 0) {
        const length = Math.sqrt(inputX * inputX + inputZ * inputZ);
        let normalizedX = inputX / length;
        let normalizedZ = inputZ / length;
        
        const rotatedX = normalizedX * Math.cos(mobileInput.cameraAngle) + normalizedZ * Math.sin(mobileInput.cameraAngle);
        const rotatedZ = -normalizedX * Math.sin(mobileInput.cameraAngle) + normalizedZ * Math.cos(mobileInput.cameraAngle);
        
        currentRotation.current = Math.atan2(rotatedX, rotatedZ);
        
        if (length > 1) {
            inputX /= length;
            inputZ /= length;
        } else {
            intensity = length;
        }
        isMoving = true;
    }

    const isRunning = keys.Shift || mobileInput.run;
    const speed = (isRunning ? speedRun : speedWalk) * (keys.w || keys.a || keys.s || keys.d || keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight ? 1 : intensity);
    
    let currentAnim = 'idle';

    if (isMoving) {
        currentAnim = isRunning ? 'run' : 'walk';
        
        const dX = inputX * speed * delta;
        const dZ = inputZ * speed * delta;
        
        const rotatedDX = dX * Math.cos(mobileInput.cameraAngle) + dZ * Math.sin(mobileInput.cameraAngle);
        const rotatedDZ = -dX * Math.sin(mobileInput.cameraAngle) + dZ * Math.cos(mobileInput.cameraAngle);
        
        currentPosition.current.x += rotatedDX;
        currentPosition.current.z += rotatedDZ;
    }

    const isThrowPressed = (keys.f || mobileInput.throw) && hasBall;

    if (isThrowPressed) {
      if (throwPhase.current === 'idle' || throwPhase.current === 'release') {
        throwPhase.current = 'windup';
        if (releaseTimer.current) clearTimeout(releaseTimer.current);
      }
    } else {
      if (throwPhase.current === 'windup') {
        if (mobileInput.throwCancel) {
          throwPhase.current = 'idle';
        } else {
          throwPhase.current = 'release';
          
          if (socket && hasBall) {
            setHasBall(false);
            const v = new THREE.Vector3(Math.sin(currentRotation.current), 0, Math.cos(currentRotation.current));
            v.normalize().multiplyScalar(15 * mobileInput.throwPower);
            v.y = 8 * mobileInput.throwPower;
            const startPos = currentPosition.current.clone();
            startPos.y += 3.0;
            
            setTimeout(() => {
              socket.emit('throwBall', { 
                  startPos: { x: startPos.x, y: startPos.y, z: startPos.z },
                  velocity: { x: v.x, y: v.y, z: v.z },
                  owner: socket.id
              });
            }, 600);
          }

          releaseTimer.current = setTimeout(() => {
            throwPhase.current = 'idle';
          }, 2000);
        }
      }
    }

    if (throwPhase.current === 'release') {
      currentAnim = 'throw';
    }
    
    if (throwPhase.current === 'windup') {
      if (mobileInput.throwAngle !== null && !mobileInput.throwCancel) {
        currentRotation.current = mobileInput.throwAngle + mobileInput.cameraAngle;
      }
      
      const dx = Math.abs(currentPosition.current.x - lastTrajUpdate.current.x);
      const dz = Math.abs(currentPosition.current.z - lastTrajUpdate.current.z);
      const dr = Math.abs(currentRotation.current - lastTrajUpdate.current.rot);
      const dp = Math.abs(mobileInput.throwPower - lastTrajUpdate.current.power);
      
      if (mobileInput.throwCancel) {
        if (trajectoryPoints.length > 0) {
          setTrajectoryPoints([]);
        }
      } else {
        if (dx > 0.1 || dz > 0.1 || dr > 0.05 || dp > 0.05 || trajectoryPoints.length === 0) {
          lastTrajUpdate.current = { x: currentPosition.current.x, z: currentPosition.current.z, rot: currentRotation.current, power: mobileInput.throwPower };
          const pts = [];
          const v = new THREE.Vector3(Math.sin(currentRotation.current), 0, Math.cos(currentRotation.current));
          v.normalize().multiplyScalar(15 * mobileInput.throwPower);
          v.y = 8 * mobileInput.throwPower;
          const gravity = -15;
          const startPos = currentPosition.current.clone();
          startPos.y += 3.0;
          
          for (let t = 0; t <= 2.5; t += 0.05) {
            const p = new THREE.Vector3(
              startPos.x + v.x * t,
              startPos.y + v.y * t + 0.5 * gravity * t * t,
              startPos.z + v.z * t
            );
            if (p.y < 0) { p.y = 0; pts.push(p); break; }
            pts.push(p);
          }
          setTrajectoryPoints(pts);
        }
      }
    } else if (trajectoryPoints.length > 0) {
      setTrajectoryPoints([]);
    }
    
    setCharacterState({
      position: [currentPosition.current.x, currentPosition.current.y, currentPosition.current.z],
      rotation: currentRotation.current,
      animation: currentAnim
    });

    if (socket && (isMoving || currentAnim !== characterState.animation)) {
      socket.emit('playerMovement', {
        x: currentPosition.current.x,
        y: currentPosition.current.y,
        z: currentPosition.current.z,
        rotation: currentRotation.current,
        animation: currentAnim
      });
    }

    const cameraOffset = new THREE.Vector3(0, 20, 25);
    cameraOffset.applyAxisAngle(new THREE.Vector3(1, 0, 0), mobileInput.cameraPitch);
    cameraOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), mobileInput.cameraAngle);
    
    const targetCameraPos = currentPosition.current.clone().add(cameraOffset);
    
    state.camera.position.lerp(targetCameraPos, 0.1);
    
    const lookAtPos = currentPosition.current.clone();
    state.camera.lookAt(lookAtPos);
  });

  return (
    <>
      <Character 
        position={characterState.position} 
        rotation={characterState.rotation} 
        animation={characterState.animation} 
        color={color}
        hp={hp}
      />
      {trajectoryPoints.length > 0 && (
        <Line 
          points={trajectoryPoints} 
          color="red" 
          lineWidth={3} 
        />
      )}
    </>
  );
}

function App() {
  const [roomId, setRoomId] = useState('0000');
  const [joined, setJoined] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [players, setPlayers] = useState<PlayersState>({});
  const [localColor, setLocalColor] = useState('#333333');
  const [balls, setBalls] = useState<any[]>([]);
  const [pickupBalls, setPickupBalls] = useState<any[]>([]);
  const [hasBall, setHasBall] = useState(false);
  const [localHp, setLocalHp] = useState(100);
  const currentPosition = useRef(new THREE.Vector3(0, 0, 0));

  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [socket]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId) {
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
        if (screen.orientation && screen.orientation.lock) {
          await screen.orientation.lock('landscape');
        }
      } catch (err) {
        console.warn('Fullscreen/orientation lock failed:', err);
      }

      const newSocket = io('https://server-vlef.onrender.com');
      
      setSocket(newSocket);

      newSocket.on('connect', () => {
        newSocket.emit('joinRoom', roomId);
        setJoined(true);
      });

      newSocket.on('currentPlayers', (currentPlayers: PlayersState) => {
        const others = { ...currentPlayers };
        if (newSocket.id) {
          if (others[newSocket.id]?.color) {
            setLocalColor(others[newSocket.id].color!);
          }
          delete others[newSocket.id];
        }
        setPlayers(others);
      });

      newSocket.on('newPlayer', (playerInfo: { id: string; position: PlayerState }) => {
        if (playerInfo.id !== newSocket.id) {
          setPlayers((prev) => ({ ...prev, [playerInfo.id]: playerInfo.position }));
        }
      });

      newSocket.on('playerMoved', (playerInfo: { id: string; position: PlayerState }) => {
        if (playerInfo.id !== newSocket.id) {
          setPlayers((prev) => ({ ...prev, [playerInfo.id]: playerInfo.position }));
        }
      });

      newSocket.on('playerDisconnected', (playerId: string) => {
        setPlayers((prev) => {
          const newPlayers = { ...prev };
          delete newPlayers[playerId];
          return newPlayers;
        });
      });

      newSocket.on('kicked', () => {
        alert('You died! You have been kicked out of the game.');
        setJoined(false);
        newSocket.disconnect();
      });

      newSocket.on('newBall', (ball: any) => {
        setBalls(prev => [...prev, ball]);
      });

      newSocket.on('initBalls', (pBalls: any[]) => {
        setPickupBalls(pBalls);
      });

      newSocket.on('ballPickedUp', ({ ballId, playerId }: any) => {
        setPickupBalls(prev => prev.filter(b => b.id !== ballId));
        if (playerId === newSocket.id) {
          setHasBall(true);
        }
      });

      newSocket.on('spawnBall', (ball: any) => {
        setPickupBalls(prev => [...prev, ball]);
      });

      newSocket.on('playerUpdated', ({ id, player }: any) => {
        if (id === newSocket.id) {
          setLocalHp(player.hp);
          if (player.hp === 100) {
            currentPosition.current.set(player.x, player.y, player.z);
          }
        } else {
          setPlayers(prev => ({ ...prev, [id]: player }));
        }
      });
    }
  };

  const handlePickup = (id: string) => {
    if (socket && !hasBall) {
      socket.emit('pickupBall', id);
    }
  };

  if (!joined) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#333' }}>
        <form onSubmit={handleJoin} style={{ background: '#fff', padding: '30px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '15px', fontFamily: 'sans-serif' }}>
          <h2 style={{ margin: 0, textAlign: 'center' }}>Join World</h2>
          <input 
            type="text" 
            placeholder="Room ID" 
            value={roomId} 
            onChange={e => setRoomId(e.target.value)} 
            style={{ padding: '10px', fontSize: '18px', textAlign: 'center', borderRadius: '6px', border: '1px solid #ccc' }}
          />
          <button type="submit" style={{ padding: '12px', fontSize: '18px', cursor: 'pointer', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>Enter</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden' }}>
      <Canvas shadows camera={{ position: [0, 20, 25], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <directionalLight 
          position={[20, 30, 10]} 
          intensity={1.5} 
          castShadow 
          shadow-mapSize={[2048, 2048]} 
          shadow-bias={-0.0001}
        />
        <Sky sunPosition={[100, 20, 100]} />
        <Environment preset="city" />

        <PlayerCharacter socket={socket} color={localColor} hp={localHp} hasBall={hasBall} setHasBall={setHasBall} currentPosition={currentPosition} />
        <Projectiles newBalls={balls} socket={socket} localSocketId={socket?.id || ''} currentPosition={currentPosition} />
        <PickupBalls balls={pickupBalls} onPickup={handlePickup} currentPosition={currentPosition} />

        {Object.entries(players).map(([id, state]) => (
          <Character 
            key={id} 
            position={[state.x, state.y, state.z]} 
            rotation={state.rotation} 
            animation={state.animation} 
            color={state.color}
            hp={state.hp}
          />
        ))}

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
          <planeGeometry args={[1000, 1000]} />
          <meshStandardMaterial color="#fafafa" roughness={1} />
        </mesh>
        
        <Grid 
          infiniteGrid 
          fadeDistance={100} 
          sectionColor="#b0b0b0" 
          cellColor="#e0e0e0" 
          position={[0, 0, 0]} 
        />
      </Canvas>
      <MobileControls hasBall={hasBall} />
      {hasBall && (
        <div style={{ position: 'absolute', top: '20px', right: '20px', width: '60px', height: '60px', background: 'rgba(0,0,0,0.4)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid white', zIndex: 100 }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#ff3333', border: '2px solid white' }} />
        </div>
      )}
    </div>
  );
}

export default App;
