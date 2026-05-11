import { useRef, useCallback, useEffect, useState } from 'react';

const DRILL_DURATION = 750;
const DRILL_OUT_DURATION = 500;

export default function useCirclePackViewport(containerRef) {
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const targetRef = useRef({ x: 0, y: 0, k: 1 });
  const currentRef = useRef({ x: 0, y: 0, k: 1 });
  const animationRef = useRef(null);
  const drillAnimRef = useRef(null);
  const pointerStartRef = useRef(null);
  const lastPinchDistRef = useRef(null);
  const isPanningRef = useRef(false);
  const didDragRef = useRef(false);
  const DRAG_THRESHOLD = 5;

  const MIN_SCALE = 0.1;
  const MAX_SCALE = 20;

  const clampScale = useCallback((k) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, k)), []);

  const startTick = useCallback(() => {
    if (animationRef.current) return;
    const tick = () => {
      const cur = currentRef.current;
      const tgt = targetRef.current;
      const dx = tgt.x - cur.x;
      const dy = tgt.y - cur.y;
      const dk = tgt.k - cur.k;

      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(dk) < 0.001) {
        currentRef.current = { ...tgt };
        setTransform({ ...tgt });
        animationRef.current = null;
        return;
      }

      const ease = 0.18;
      currentRef.current = {
        x: cur.x + dx * ease,
        y: cur.y + dy * ease,
        k: cur.k + dk * ease,
      };
      setTransform({ ...currentRef.current });
      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
  }, []);

  const panTo = useCallback((x, y, k) => {
    targetRef.current = { x, y, k: clampScale(k) };
    startTick();
  }, [clampScale, startTick]);

  const animateTo = useCallback((targetTransform, duration = DRILL_DURATION) => {
    if (drillAnimRef.current) cancelAnimationFrame(drillAnimRef.current);

    const start = { ...currentRef.current };
    const target = { x: targetTransform.x, y: targetTransform.y, k: clampScale(targetTransform.k) };
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const current = {
        x: start.x + (target.x - start.x) * eased,
        y: start.y + (target.y - start.y) * eased,
        k: start.k + (target.k - start.k) * eased,
      };

      currentRef.current = current;
      targetRef.current = current;
      setTransform({ ...current });

      if (progress < 1) {
        drillAnimRef.current = requestAnimationFrame(animate);
      } else {
        drillAnimRef.current = null;
        currentRef.current = { ...target };
        targetRef.current = { ...target };
        setTransform({ ...target });
      }
    };

    drillAnimRef.current = requestAnimationFrame(animate);
    return () => { if (drillAnimRef.current) cancelAnimationFrame(drillAnimRef.current); };
  }, [clampScale]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const cur = targetRef.current;

    if (e.shiftKey) {
      // Shift+scroll = pan
      targetRef.current = {
        x: cur.x - e.deltaX - e.deltaY,
        y: cur.y,
        k: cur.k,
      };
    } else {
      // Default scroll = zoom at cursor position
      // ctrlKey is also sent by trackpad pinch gestures
      const zoomSpeed = e.ctrlKey ? 0.005 : 0.003;
      const delta = -e.deltaY * zoomSpeed;
      const newK = clampScale(cur.k * (1 + delta));
      const ratio = newK / cur.k;

      targetRef.current = {
        x: mouseX - (mouseX - cur.x) * ratio,
        y: mouseY - (mouseY - cur.y) * ratio,
        k: newK,
      };
    }
    startTick();
  }, [clampScale, startTick, containerRef]);

  const handlePointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    didDragRef.current = false;
    pointerStartRef.current = { x: e.clientX, y: e.clientY, tx: targetRef.current.x, ty: targetRef.current.y };
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (!pointerStartRef.current) return;
    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;
    if (!isPanningRef.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    isPanningRef.current = true;
    didDragRef.current = true;
    targetRef.current = {
      ...targetRef.current,
      x: pointerStartRef.current.tx + dx,
      y: pointerStartRef.current.ty + dy,
    };
    startTick();
  }, [startTick]);

  const handlePointerUp = useCallback(() => {
    isPanningRef.current = false;
    pointerStartRef.current = null;
  }, []);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDistRef.current = Math.hypot(dx, dy);
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && lastPinchDistRef.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const scale = dist / lastPinchDistRef.current;
      lastPinchDistRef.current = dist;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

      const cur = targetRef.current;
      const newK = clampScale(cur.k * scale);
      const ratio = newK / cur.k;
      targetRef.current = {
        x: cx - (cx - cur.x) * ratio,
        y: cy - (cy - cur.y) * ratio,
        k: newK,
      };
      startTick();
    }
  }, [clampScale, startTick, containerRef]);

  const handleTouchEnd = useCallback(() => {
    lastPinchDistRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (drillAnimRef.current) cancelAnimationFrame(drillAnimRef.current);
    };
  }, []);

  const setImmediate = useCallback((t) => {
    currentRef.current = { ...t };
    targetRef.current = { ...t };
    setTransform({ ...t });
  }, []);

  return {
    transform,
    panTo,
    animateTo,
    setImmediate,
    didDragRef,
    wheelHandler: handleWheel,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    DRILL_DURATION,
    DRILL_OUT_DURATION,
  };
}
