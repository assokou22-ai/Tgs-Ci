import React, { useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';

const SignaturePad = forwardRef((props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
        const context = canvas.getContext('2d');
        context?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  const getMousePos = (canvas: HTMLCanvasElement, evt: MouseEvent | TouchEvent) => {
    const rect = canvas.getBoundingClientRect();
    if (evt instanceof MouseEvent) {
      return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top,
      };
    }
    if (evt.touches && evt.touches.length > 0) {
      return {
        x: evt.touches[0].clientX - rect.left,
        y: evt.touches[0].clientY - rect.top,
      };
    }
    return { x: 0, y: 0 };
  };

  const startDrawing = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    
    const pos = getMousePos(canvas, e);
    isDrawing.current = true;
    context.beginPath();
    context.moveTo(pos.x, pos.y);
  }, []);

  const handleDrawing = useCallback((e: MouseEvent | TouchEvent) => {
     if (!isDrawing.current) return;
     e.preventDefault();
     const canvas = canvasRef.current;
     const context = canvas?.getContext('2d');
     if (!canvas || !context) return;

     const pos = getMousePos(canvas, e);
     context.lineTo(pos.x, pos.y);
     context.stroke();
  },[]);

  const stopDrawing = useCallback(() => {
    const context = canvasRef.current?.getContext('2d');
    if (context) {
        context.closePath();
    }
    isDrawing.current = false;
  }, []);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    
    const setCanvasStyle = () => {
        const isDarkMode = document.documentElement.classList.contains('dark');
        context.strokeStyle = isDarkMode ? '#FFFFFF' : '#000000';
    }
    
    const resizeCanvas = () => {
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width;
      canvas.height = height;
      setCanvasStyle();
      context.lineWidth = 3.5; // Made the line thicker for better visibility and feel
      context.lineCap = 'round';
      context.lineJoin = 'round';
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    const themeObserver = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            if (mutation.attributeName === 'class') {
                setCanvasStyle();
            }
        });
    });
    themeObserver.observe(document.documentElement, { attributes: true });
    
    // Mouse events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', handleDrawing);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    // Touch events (passive: false is important to allow preventDefault)
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', handleDrawing, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      themeObserver.disconnect();
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', handleDrawing);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseout', stopDrawing);
      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchmove', handleDrawing);
      canvas.removeEventListener('touchend', stopDrawing);
    };
  }, [startDrawing, handleDrawing, stopDrawing]);
  
  useImperativeHandle(ref, () => ({
    getSignature: () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const context = canvas.getContext('2d');
        if(!context) return '';
        const pixelBuffer = new Uint32Array(
            context.getImageData(0, 0, canvas.width, canvas.height).data.buffer
        );
        const isBlank = !pixelBuffer.some(color => color !== 0);
        if(isBlank) return '';
        
        return canvas.toDataURL('image/png');
      }
      return '';
    },
    clear: clearCanvas,
  }));

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="w-full h-40 bg-gray-200 dark:bg-gray-700 border-2 border-dashed border-gray-400 dark:border-gray-500 rounded-md cursor-crosshair touch-none"
      />
      <button
        type="button"
        onClick={clearCanvas}
        className="absolute top-2 right-2 z-10 px-3 py-1 text-xs font-semibold text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-700 focus:ring-red-500 transition"
        title="Effacer la signature"
      >
        Effacer
      </button>
    </div>
  );
});

SignaturePad.displayName = 'SignaturePad';

export default SignaturePad;