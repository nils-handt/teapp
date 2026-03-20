import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonFabButton, IonIcon } from '@ionic/react';
import React, { useEffect, useRef } from 'react';
import { useStore } from '../../stores/useStore';
import { BrewingPhase } from '../../services/interfaces/brewing.types';
import DesignSwitcher from '../../components/DesignSwitcher';
import { brewingSessionService } from '../../services/brewing/BrewingSessionService';
import { play, stop, refresh, checkmarkCircle } from 'ionicons/icons';
import { useBrewingControl } from '../../hooks/useBrewingControl';

const BrewingFlow: React.FC = () => {
    const { brewingPhase, timerValue, currentWeight } = useStore();
    const { startBrewingSession, handleEndSession, recordingAlert } = useBrewingControl();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number>();

    // Bubble animation logic
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const bubbles: { x: number, y: number, r: number, s: number }[] = [];
        const createBubble = () => ({
            x: Math.random() * canvas.width,
            y: canvas.height + 20,
            r: Math.random() * 10 + 2,
            s: Math.random() * 2 + 1
        });

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resize);
        resize();

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Dynamic background based on phase
            if (brewingPhase === BrewingPhase.INFUSION) {
                ctx.fillStyle = '#e3f2fd'; // Light Blue
            } else if (brewingPhase === BrewingPhase.REST) {
                ctx.fillStyle = '#f1f8e9'; // Light Green
            } else {
                ctx.fillStyle = '#fff';
            }
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Bubbles if active
            if (brewingPhase === BrewingPhase.INFUSION || brewingPhase === BrewingPhase.INFUSION_VESSEL_LIFTED) {
                if (Math.random() < 0.1) bubbles.push(createBubble());

                bubbles.forEach((b, i) => {
                    b.y -= b.s;
                    ctx.beginPath();
                    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(33, 150, 243, 0.3)';
                    ctx.fill();

                    if (b.y < -20) bubbles.splice(i, 1);
                });
            }

            // Timer Ring
            const cx = canvas.width / 2;
            const cy = canvas.height / 3;
            const r = 100;

            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.strokeStyle = '#ddd';
            ctx.lineWidth = 10;
            ctx.stroke();

            if (timerValue > 0) {
                // const angle = (Date.now() / 1000) % (Math.PI * 2); // Rotate logic or actual progress
                // Actually just rotate for flow feel
                ctx.beginPath();
                ctx.arc(cx, cy, r, -Math.PI / 2, (timerValue / 1000) * 0.1 - Math.PI / 2); // Mock progress
                ctx.strokeStyle = '#2196f3';
                ctx.lineWidth = 10;
                ctx.stroke();
            }

            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            window.removeEventListener('resize', resize);
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [brewingPhase, timerValue]);

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <IonToolbar color="transparent">
                    <IonTitle style={{ color: '#fff' }}>Flow</IonTitle>
                    <DesignSwitcher />
                </IonToolbar>
            </IonHeader>
            <IonContent fullscreen scrollY={false}>

                <canvas ref={canvasRef} style={{ width: '100%', height: '100%', background: 'linear-gradient(to bottom, #4facfe 0%, #00f2fe 100%)' }} />
                <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                    <h1 style={{ fontSize: '4rem', margin: 0 }}>{(timerValue / 1000).toFixed(1)}</h1>
                    <p style={{ fontSize: '1.2rem', color: '#666' }}>{currentWeight.toFixed(1)}g</p>
                </div>

                <div style={{
                    position: 'absolute',
                    bottom: '50px',
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '20px'
                }}>
                    {brewingPhase === BrewingPhase.IDLE || brewingPhase === BrewingPhase.ENDED ? (
                        <IonFabButton color="light" onClick={() => startBrewingSession('Flow Tea')}>
                            <IonIcon icon={play} />
                        </IonFabButton>
                    ) : (
                        <IonFabButton color="danger" onClick={() => handleEndSession()}>
                            <IonIcon icon={stop} />
                        </IonFabButton>
                    )}

                    {brewingPhase === BrewingPhase.SETUP && (
                        <IonFabButton color="warning" onClick={() => brewingSessionService.confirmSetupDone()}>
                            <IonIcon icon={checkmarkCircle} />
                        </IonFabButton>
                    )}

                    <IonFabButton color="light" size="small" onClick={() => brewingSessionService.manuallyStartInfusion()}>
                        <IonIcon icon={refresh} />
                    </IonFabButton>
                </div>
                {recordingAlert}
            </IonContent>
        </IonPage>
    );
};
export default BrewingFlow;
