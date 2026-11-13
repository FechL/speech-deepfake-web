import React, { useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';

const GridBackground = ({ color, showScanner = false }) => {
  const canvasRef = useRef(null);
  const { theme } = useApp();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let scannerY = 0;
    let direction = 1;

    const resizeCanvas = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const getGridColor = () => {
      if (color) return color;
      return theme === 'dark' 
        ? 'rgba(0, 218, 243, 0.03)' 
        : 'rgba(0, 82, 255, 0.04)';
    };

    const getScannerColor = () => {
      return theme === 'dark'
        ? 'rgba(0, 218, 243, 0.08)'
        : 'rgba(0, 82, 255, 0.06)';
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const gridColor = getGridColor();
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;

      const step = 24;

      for (let x = 0; x < canvas.width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      for (let y = 0; y < canvas.height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      if (showScanner) {
        const grad = ctx.createLinearGradient(0, scannerY - 40, 0, scannerY + 40);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(0.5, getScannerColor());
        grad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = grad;
        ctx.fillRect(0, scannerY - 40, canvas.width, 80);

        ctx.strokeStyle = theme === 'dark' ? 'rgba(0, 218, 243, 0.3)' : 'rgba(0, 82, 255, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, scannerY);
        ctx.lineTo(canvas.width, scannerY);
        ctx.stroke();

        scannerY += 1.2 * direction;
        if (scannerY >= canvas.height || scannerY <= 0) {
          direction *= -1;
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme, color, showScanner]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        borderRadius: 'inherit'
      }}
    />
  );
};

export default GridBackground;
