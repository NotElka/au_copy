import React, { useEffect, useState } from 'react';

// Дизайн делается под фиксированный canvas 1920×1080.
// Этот wrapper рассчитывает scale так, чтобы canvas целиком влезал в любой viewport
// без скроллбаров, сохраняя пропорции (letterbox при несовпадении соотношения сторон).
export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;

const ScaleToFit = ({ children }) => {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const update = () => {
      const sx = window.innerWidth / DESIGN_WIDTH;
      const sy = window.innerHeight / DESIGN_HEIGHT;
      setScale(Math.min(sx, sy));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#0F172A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: DESIGN_WIDTH,
          height: DESIGN_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          flexShrink: 0,
          position: 'relative',
          background: '#FFFFFF',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default ScaleToFit;
