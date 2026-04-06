import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonFabButton, IonIcon } from '@ionic/react';
import React, { useEffect, useRef } from 'react';
import { BrewingPhase } from '../../services/interfaces/brewing.types';
import DesignSwitcher from '../../components/DesignSwitcher';
import { brewingSessionService } from '../../services/brewing/BrewingSessionService';
import { play, stop, refresh, checkmarkCircle } from 'ionicons/icons';
import { useBrewingControl } from '../../hooks/useBrewingControl';
import { useShallow } from 'zustand/react/shallow';
import { useBrewingStore } from '../../stores/useBrewingStore';
import { useScaleStore } from '../../stores/useScaleStore';

const BrewingFlow: React.FC = () => {
    const { brewingPhase, timerValue } = useBrewingStore(useShallow((state) => ({
        brewingPhase: state.brewingPhase,
        timerValue: state.timerValue,
    })));
    const currentWeight = useScaleStore((state) => state.currentWeight);
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
            <IonHeader className="[--border-width:0]">
                <IonToolbar color="transparent">
                    <IonTitle className="text-white">Flow</IonTitle>
                    <DesignSwitcher />
                </IonToolbar>
            </IonHeader>
            <IonContent fullscreen scrollY={false}>

                <canvas ref={canvasRef} className="h-full w-full bg-[image:var(--zen-flow-background)]" />
                <div className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                    <h1 className="m-0 text-[4rem]">{(timerValue / 1000).toFixed(1)}</h1>
                    <p className="text-[1.2rem] text-[#666]">{currentWeight.toFixed(1)}g</p>
                </div>

                <div className="absolute bottom-[50px] flex w-full justify-center gap-5">
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
