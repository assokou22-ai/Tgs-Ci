import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Camera, RefreshCw, AlertTriangle, Search, Info, Zap } from 'lucide-react';
import jsQR from 'jsqr';
import { RepairTicket } from '../types.ts';
import useRepairTickets from '../hooks/useRepairTickets.ts';
import { decodeTicketId } from '../utils/qrSecurity.ts';
import { useAppSettings } from '../hooks/useAppSettings.ts';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTicket?: (ticket: RepairTicket) => void;
}

const QrScannerModal: React.FC<QrScannerModalProps> = ({ isOpen, onClose, onSelectTicket }) => {
  const { tickets } = useRepairTickets();
  const { settings } = useAppSettings();
  const [matchedConfirmTicket, setMatchedConfirmTicket] = useState<RepairTicket | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [scanStatus, setScanStatus] = useState<'pending' | 'scanning' | 'success' | 'error' | 'permission_denied'>('pending');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [manualId, setManualId] = useState<string>('');
  const [manualError, setManualError] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const scanFinishedRef = useRef<boolean>(false);

  // Play a beautiful synthesized beep using native browser Web Audio API
  const playSuccessBeep = () => {
    try {
      const windowObj = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const AudioContextClass = windowObj.AudioContext || windowObj.webkitAudioContext;
      if (!AudioContextClass) return;
      
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(950, ctx.currentTime); // Standard pleasant beep
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {
      console.warn("Audio feedback not supported or blocked by user gesture:", e);
    }
  };

  // Smart matching and retrieval logic
  const processScannedData = useCallback((scannedText: string): boolean => {
    if (!scannedText) return false;

    // Clean scanned string
    let parsedId = scannedText.trim();

    // First try decoding using our custom secure decryptor utility
    const secureDecodedId = decodeTicketId(parsedId);
    if (secureDecodedId) {
      parsedId = secureDecodedId;
    } else {
      // If it fails to decrypt, let's process URL and fallback strings in case they are parsed/legacy
      if (parsedId.includes('http://') || parsedId.includes('https://')) {
        try {
          const urlOb = new URL(parsedId);
          const urlId = urlOb.searchParams.get('ticketId') || urlOb.searchParams.get('search') || urlOb.searchParams.get('q');
          if (urlId) {
            parsedId = urlId.trim();
          } else {
            // If URL doesn't have params, maybe the ID matches the last element of the pathname
            const lastPathSegment = urlOb.pathname.split('/').filter(Boolean).pop();
            if (lastPathSegment && lastPathSegment.toLowerCase().startsWith('tgs')) {
              parsedId = lastPathSegment.trim();
            }
          }
        } catch (e) {
          console.warn("Error parsing scanned text as URL:", e);
        }
      }
    }

    // Now scan through available tickets (ignore symbols, spaces and case)
    const normalizedTarget = parsedId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    
    const matchedTicket = tickets.find(ticket => {
      const normalizedTicketId = ticket.id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      return normalizedTicketId === normalizedTarget || ticket.id.toUpperCase() === parsedId.toUpperCase();
    });

    if (matchedTicket) {
      playSuccessBeep();
      scanFinishedRef.current = true;
      const directQrScan = settings.device?.directQrScan !== false;

      if (directQrScan) {
        setScanStatus('success');

        // Update location search params to trigger direct ticket view
        const newUrl = new URL(window.location.href);
        if (!['accueil', 'technicien', 'editeur'].includes(newUrl.searchParams.get('role') || '')) {
          newUrl.searchParams.set('role', 'technicien');
        }
        newUrl.searchParams.set('ticketId', matchedTicket.id);
        window.history.pushState({}, '', newUrl);
        window.dispatchEvent(new PopStateEvent('popstate'));
        
        // Call prop if provided
        if (onSelectTicket) {
          onSelectTicket(matchedTicket);
        }

        // Close the modal
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setMatchedConfirmTicket(matchedTicket);
      }

      return true;
    }
    
    return false;
  }, [tickets, onSelectTicket, onClose, settings]);

  // Clean-up handler
  const stopStream = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Enumerate cameras
  useEffect(() => {
    if (!isOpen) return;

    const listDevices = async () => {
      try {
        // Request immediate basic constraints to prompt permission if not yet given
        const permissionStream = await navigator.mediaDevices.getUserMedia({ video: true });
        
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        
        // Immediately stop all tracks to make sure iPadOS/iOS can start the actual feed without hardware lock
        permissionStream.getTracks().forEach(track => track.stop());

        const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
        setDevices(videoDevices);
        
        if (videoDevices.length > 0) {
          // Select rear camera by default if available (often contains "back", "rear", "environnement" or "environment")
          const backCamera = videoDevices.find(d => 
            d.label.toLowerCase().includes('back') || 
            d.label.toLowerCase().includes('rear') || 
            d.label.toLowerCase().includes('environ')
          );
          setSelectedDeviceId(backCamera ? backCamera.deviceId : videoDevices[0].deviceId);
        }
      } catch (err) {
        console.error("Camera enumeration failed:", err);
        setScanStatus('permission_denied');
        setErrorMsg("L'autorisation d'accéder à la caméra a été refusée ou n'est pas supportée dans ce navigateur.");
      }
    };

    listDevices();
  }, [isOpen]);

  // Start feed when device ID changes or modal opens
  useEffect(() => {
    if (!isOpen || !selectedDeviceId) return;

    // Define decoding loop internally to avoid dependency constraints
    const startCamera = async () => {
      // Clear previous stream
      stopStream();
      scanFinishedRef.current = false;
      setScanStatus('pending');
      setErrorMsg('');

      try {
        const constraints: MediaStreamConstraints = {
          video: {
            deviceId: { exact: selectedDeviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 }
            // Do not combine exact deviceId and facingMode: environment as it conflicts on iOS/Safari
          }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true'); // prevents iOS full-screen play
          videoRef.current.setAttribute('muted', 'true');
          videoRef.current.muted = true; // WebKit autoplay requirement
          await videoRef.current.play();
          setScanStatus('scanning');
          
          // Reset torch setting on new stream start
          setTorchOn(false);
          
          // Start the scanning frame analysis loop
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (video && canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              const decodeFrame = () => {
                if (video.paused || video.ended || scanFinishedRef.current) {
                  animationFrameRef.current = requestAnimationFrame(decodeFrame);
                  return;
                }

                if (video.readyState === video.HAVE_CURRENT_DATA || video.readyState === video.HAVE_ENOUGH_DATA) {
                  canvas.width = video.videoWidth;
                  canvas.height = video.videoHeight;
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                  const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: 'dontInvert'
                  });

                  if (code && code.data) {
                    const success = processScannedData(code.data);
                    if (success) {
                      return; // stop analysis sequence
                    }
                  }
                }

                animationFrameRef.current = requestAnimationFrame(decodeFrame);
              };

              animationFrameRef.current = requestAnimationFrame(decodeFrame);
            }
          }
        }
      } catch (err) {
        console.error("Failed to start camera feed:", err);
        // If exact device constraint fails, try generic
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
          });
          streamRef.current = fallbackStream;
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            videoRef.current.setAttribute('playsinline', 'true');
            videoRef.current.setAttribute('muted', 'true');
            videoRef.current.muted = true;
            await videoRef.current.play();
            setScanStatus('scanning');
            
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (video && canvas) {
              const ctx = canvas.getContext('2d');
              if (ctx) {
                const decodeFrameFallback = () => {
                  if (video.paused || video.ended || scanFinishedRef.current) {
                    animationFrameRef.current = requestAnimationFrame(decodeFrameFallback);
                    return;
                  }

                  if (video.readyState === video.HAVE_CURRENT_DATA || video.readyState === video.HAVE_ENOUGH_DATA) {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const code = jsQR(imageData.data, imageData.width, imageData.height, {
                      inversionAttempts: 'dontInvert'
                    });

                    if (code && code.data) {
                      const success = processScannedData(code.data);
                      if (success) {
                        return; // stop analysis sequence
                      }
                    }
                  }

                  animationFrameRef.current = requestAnimationFrame(decodeFrameFallback);
                };

                animationFrameRef.current = requestAnimationFrame(decodeFrameFallback);
              }
            }
          }
        } catch {
          setScanStatus('error');
          setErrorMsg("Impossible de démarrer la caméra. Vérifiez qu'aucune autre application ne l'utilise.");
        }
      }
    };

    startCamera();

    return () => {
      stopStream();
    };
  }, [isOpen, selectedDeviceId, processScannedData, stopStream]);

  // Toggle Torch on supported devices
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const capabilities = track.getCapabilities() as { torch?: boolean };
      if (capabilities && capabilities.torch) {
        const nextTorch = !torchOn;
        const constraints = {
          advanced: [{ torch: nextTorch }]
        } as unknown as MediaTrackConstraints;
        await track.applyConstraints(constraints);
        setTorchOn(nextTorch);
      } else {
        alert("La fonction lampe-torche (flash) n'est pas disponible pour cet objectif caméra sur ce navigateur.");
      }
    } catch (e) {
      console.error("Failed to toggle torch:", e);
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(false);
    
    if (!manualId || manualId.trim().length === 0) return;
    
    const success = processScannedData(manualId);
    if (!success) {
      setManualError(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-zinc-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl shadow-black/80">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-apple-blue" />
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wider leading-none">Cam-Scanner TGS CI</h2>
              <span className="text-[8px] font-black text-apple-blue uppercase tracking-widest mt-1 inline-block">Recherche instantanée</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-2xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Feed Frame Body */}
        <div className="p-5 flex flex-col items-center">
          
          {/* CAMERA STAGED AREA */}
          <div className="relative w-full aspect-video md:aspect-[4/3] max-h-[280px] rounded-2xl overflow-hidden border border-white/10 bg-black flex items-center justify-center">
            
            {/* Hidden canvas for image analysis */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Video element */}
            <video 
              ref={videoRef} 
              className={`w-full h-full object-cover ${scanStatus === 'success' ? 'opacity-30' : 'opacity-100'}`}
            />

            {/* Confirmation overlay if direct scan is disabled */}
            {matchedConfirmTicket && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 p-5 text-center animate-fade-in z-20">
                <div className="w-12 h-12 rounded-full bg-apple-blue/20 flex items-center justify-center mb-2.5 border border-apple-blue/50 animate-pulse">
                  <Search className="w-5 h-5 text-apple-blue" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-wider text-white">Ticket Détecté</h3>
                <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-0.5">Confirmation de redirection</p>
                
                <div className="my-3.5 p-3 bg-white/5 border border-white/10 rounded-xl w-full max-w-[270px] text-left space-y-1">
                  <p className="text-xs font-black text-apple-blue uppercase tracking-tight font-mono">
                    Réf : {matchedConfirmTicket.id}
                  </p>
                  <p className="text-[11px] font-bold text-zinc-200 truncate uppercase tracking-tight">
                    Client : {matchedConfirmTicket.client.name}
                  </p>
                  <p className="text-[10px] font-semibold text-zinc-400 truncate uppercase mt-1">
                    {matchedConfirmTicket.macBrand} {matchedConfirmTicket.macModel}
                  </p>
                </div>

                <div className="flex gap-2 w-full max-w-[270px]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMatchedConfirmTicket(null);
                      scanFinishedRef.current = false;
                    }}
                    type="button"
                    className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-colors border border-white/10"
                  >
                    Reprendre
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Redirect manually
                      const newUrl = new URL(window.location.href);
                      if (!['accueil', 'technicien', 'editeur'].includes(newUrl.searchParams.get('role') || '')) {
                        newUrl.searchParams.set('role', 'technicien');
                      }
                      newUrl.searchParams.set('ticketId', matchedConfirmTicket.id);
                      window.history.pushState({}, '', newUrl);
                      window.dispatchEvent(new PopStateEvent('popstate'));
                      
                      if (onSelectTicket) {
                        onSelectTicket(matchedConfirmTicket);
                      }
                      onClose();
                    }}
                    type="button"
                    className="flex-1 py-1.5 bg-apple-blue hover:bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                  >
                    Ouvrir
                  </button>
                </div>
              </div>
            )}

            {/* NEON TARGET RANGING SCOPE FOR USER */}
            {scanStatus === 'scanning' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-40 h-40 sm:w-48 sm:h-48 border-2 border-transparent">
                  {/* Glowing camera corners */}
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-apple-blue rounded-tl-md"></div>
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-apple-blue rounded-tr-md"></div>
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-apple-blue rounded-bl-md"></div>
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-apple-blue rounded-br-md"></div>
                  
                  {/* Laser line slider */}
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_12px_#ef4444] animate-bounce" style={{ animationDuration: '3s' }}></div>
                </div>
              </div>
            )}

            {/* Status overlay screens */}
            {scanStatus === 'pending' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/80 text-zinc-400 p-4 text-center">
                <RefreshCw className="w-8 h-8 text-apple-blue animate-spin mb-3" />
                <p className="text-[10px] font-black uppercase tracking-wider text-white">Initialisation de la caméra...</p>
                <p className="text-[8px] text-zinc-500 mt-1 uppercase text-center">Veuillez autoriser l'accès à la caméra de votre appareil.</p>
              </div>
            )}

            {scanStatus === 'success' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-500/10 text-green-400 text-center animate-pulse">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-3 border-2 border-green-500 animate-scale-up">
                  <span className="text-2xl">✓</span>
                </div>
                <p className="text-xs font-black uppercase tracking-widest text-white">DOSSIER RÉCUPÉRÉ !</p>
                <p className="text-[8px] text-zinc-400 mt-1 uppercase tracking-wider">Redirection vers la fiche technique...</p>
              </div>
            )}

            {scanStatus === 'permission_denied' && (
              <div className="absolute inset-x-0 inset-y-0 flex flex-col items-center justify-center bg-red-950/90 text-red-400 p-6 text-center">
                <AlertTriangle className="w-10 h-10 text-red-500 mb-3" />
                <p className="text-xs font-black uppercase tracking-widest text-white">Caméra inaccessible</p>
                <p className="text-[9px] text-red-300 mt-2 max-w-[320px]">{errorMsg}</p>
              </div>
            )}

            {scanStatus === 'error' && (
              <div className="absolute inset-x-0 inset-y-0 flex flex-col items-center justify-center bg-amber-950/90 text-amber-500 p-6 text-center">
                <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
                <p className="text-xs font-black uppercase tracking-widest text-white">Erreur de chargement</p>
                <p className="text-[9px] text-amber-300 mt-2 max-w-[320px]">{errorMsg}</p>
              </div>
            )}
          </div>

          {/* CONTROLS (Cameras & Flashlight) */}
          {scanStatus === 'scanning' && (
            <div className="w-full flex items-center justify-between gap-3 mt-4">
              
              {/* Select Camera Dropdown */}
              <div className="flex-1 flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-2xl px-3 py-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-zinc-500" />
                <select 
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  className="w-full bg-transparent text-[10px] text-zinc-300 font-black tracking-tight outline-none border-none py-1 uppercase cursor-pointer"
                >
                  {devices.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId} className="bg-zinc-900 text-white">
                      {device.label || `Lentille Caméra #${index + 1}`}
                    </option>
                  ))}
                  {devices.length === 0 && (
                    <option value="">Objectif principal</option>
                  )}
                </select>
              </div>

              {/* Torch Toggle button */}
              <button
                onClick={toggleTorch}
                type="button"
                className={`p-2.5 rounded-2xl border transition-all shrink-0 flex items-center justify-center ${
                  torchOn 
                  ? 'bg-amber-500/20 border-amber-500 text-amber-400' 
                  : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
                }`}
                title="Activer la lampe torche"
              >
                <Zap className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* MANUAL ENTRY FALLBACK FORM */}
          <div className="w-full mt-6 pt-5 border-t border-white/5">
            <div className="flex items-center gap-2 mb-3 bg-white/5 px-3 py-2 rounded-xl text-zinc-400">
              <Info className="w-3.5 h-3.5 text-apple-blue shrink-0" />
              <p className="text-[9px] font-bold uppercase tracking-tight text-zinc-400 leading-snug text-left">
                Placez le QR code de l'appareil face caméra. Alternativement, saisissez son code à trois ou quatre chiffres ci-dessous.
              </p>
            </div>

            <form onSubmit={handleManualSearch} className="flex gap-2">
              <div className="flex-1 relative">
                <input 
                  type="text" 
                  value={manualId}
                  onChange={(e) => {
                    setManualId(e.target.value);
                    setManualError(false);
                  }}
                  placeholder="EX: TGS-2026-0045 OU 0045"
                  className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-2xl text-[10px] font-bold text-white tracking-widest placeholder:text-zinc-600 outline-none uppercase text-center focus:border-apple-blue"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-apple-blue hover:bg-blue-600 rounded-2xl text-[10px] font-black uppercase tracking-wider text-white flex items-center gap-1.5 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
              >
                <Search className="w-3.5 h-3.5" /> chercher
              </button>
            </form>

            {manualError && (
              <p className="text-center text-[9px] font-bold uppercase tracking-wider text-red-400 mt-2 bg-red-950/20 py-1 rounded-lg border border-red-500/10">
                ❌ Aucun dossier ne correspond à la référence saisie.
              </p>
            )}
          </div>

        </div>

        {/* Footer info branding line */}
        <div className="bg-black/50 px-5 py-3 border-t border-white/5 flex items-center justify-between text-[8px] font-extrabold text-zinc-600 uppercase tracking-widest">
          <span>TGS CI SYSTEM DEPT</span>
          <span>WEBCAM DECODER ACTIVE v1.2</span>
        </div>

      </div>
    </div>
  );
};

export default QrScannerModal;
